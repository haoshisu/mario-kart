import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../createGameServer";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import {
  ROOM_MESSAGE,
  type InputAppliedMessage,
  type ProtocolErrorMessage,
  type RelayedInputPacket,
  type RoomStatusMessage,
} from "../../src/game/network/protocol";

function nextMessage<T>(
  room: Room,
  type: string,
  predicate: (message: T) => boolean = () => true,
  timeoutMs = 1_000,
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), timeoutMs);
    const unsubscribe = room.onMessage<T>(type, (message) => {
      if (!predicate(message)) {
        return;
      }
      clearTimeout(timeout);
      unsubscribe();
      resolve(message);
    });
  });
}

describe("RaceRoom", () => {
  const { gameServer, httpServer } = createGameServer();
  let endpoint = "";

  beforeAll(async () => {
    await gameServer.listen(0, "127.0.0.1");
    const address = httpServer.address() as AddressInfo;
    endpoint = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await gameServer.gracefullyShutdown(false);
  });

  it("creates a room, pairs one controller, and returns to waiting after leave", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, { role: "host" });
    expect(host.roomId).toMatch(/^[A-Za-z0-9_-]{9}$/);

    const connectedStatus = nextMessage<RoomStatusMessage>(
      host,
      ROOM_MESSAGE.roomStatus,
      (status) => status.controller === "connected",
    );
    const controller = await client.joinById(host.roomId, {
      role: "controller",
      nickname: "  Test   Driver  ",
    });
    await expect(connectedStatus).resolves.toMatchObject({
      controller: "connected",
      controllerNickname: "Test Driver",
    });

    const waitingStatus = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus);
    await controller.leave();
    await expect(waitingStatus).resolves.toMatchObject({
      controller: "waiting",
      controllerNickname: null,
    });
    await host.leave();
  });

  it("rejects nonexistent rooms and a second controller", async () => {
    const client = new Client(endpoint);
    await expect(
      client.joinById("missing01", { role: "controller", nickname: "No room" }),
    ).rejects.toBeTruthy();

    const host = await client.create(NETWORK_CONFIG.roomType, { role: "host" });
    const controller = await client.joinById(host.roomId, {
      role: "controller",
      nickname: "First",
    });
    await expect(
      client.joinById(host.roomId, { role: "controller", nickname: "Second" }),
    ).rejects.toBeTruthy();
    await controller.leave();
    await host.leave();
  });

  it("rejects unauthorized input and rate-limits rapid controller packets", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, { role: "host" });
    const controller = await client.joinById(host.roomId, {
      role: "controller",
      nickname: "Driver",
    });
    const packet = {
      sequence: 1,
      sentAt: Date.now(),
      input: { throttle: 1, brake: 0, steer: 0, drift: false },
    };

    const unauthorized = nextMessage<ProtocolErrorMessage>(host, ROOM_MESSAGE.protocolError);
    host.send(ROOM_MESSAGE.input, packet);
    await expect(unauthorized).resolves.toMatchObject({ code: "unauthorized" });

    const relayed = nextMessage<RelayedInputPacket>(host, ROOM_MESSAGE.inputRelay);
    controller.send(ROOM_MESSAGE.input, packet);
    await expect(relayed).resolves.toMatchObject({ sequence: 1, input: { throttle: 1 } });

    const applied = nextMessage<InputAppliedMessage>(controller, ROOM_MESSAGE.inputApplied);
    host.send(ROOM_MESSAGE.inputApplied, {
      sequence: packet.sequence,
      sentAt: packet.sentAt,
    });
    await expect(applied).resolves.toEqual({
      sequence: packet.sequence,
      sentAt: packet.sentAt,
    });

    const rateLimited = nextMessage<ProtocolErrorMessage>(controller, ROOM_MESSAGE.protocolError);
    controller.send(ROOM_MESSAGE.input, { ...packet, sequence: 2 });
    await expect(rateLimited).resolves.toMatchObject({ code: "rate-limited" });

    await controller.leave();
    await host.leave();
  });

  it("resets a non-neutral input after the controller timeout", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, { role: "host" });
    const controller = await client.joinById(host.roomId, {
      role: "controller",
      nickname: "Timeout",
    });
    controller.send(ROOM_MESSAGE.input, {
      sequence: 1,
      sentAt: Date.now(),
      input: { throttle: 1, brake: 0, steer: 0, drift: false },
    });

    const reset = nextMessage<{ reason: string }>(
      host,
      ROOM_MESSAGE.inputReset,
      () => true,
      2_000,
    );
    await expect(reset).resolves.toEqual({ reason: "timeout" });
    await controller.leave();
    await host.leave();
  });
});
