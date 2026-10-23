import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../createGameServer";
import { NETWORK_CONFIG, PLAYER_COLORS } from "../../src/game/network/networkConfig";
import {
  ROOM_MESSAGE,
  type InputAppliedMessage,
  type ProtocolErrorMessage,
  type RaceSnapshot,
  type RoomStatusMessage,
} from "../../src/game/network/protocol";

function nextMessage<T>(
  room: Room,
  type: string,
  predicate: (message: T) => boolean = () => true,
  timeoutMs = 1_500,
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

const hostOptions = {
  role: "host",
  protocolVersion: NETWORK_CONFIG.protocolVersion,
} as const;

function playerOptions(index: number) {
  return {
    role: "controller",
    nickname: `Driver ${index + 1}`,
    color: PLAYER_COLORS[index],
    protocolVersion: NETWORK_CONFIG.protocolVersion,
  } as const;
}

describe("RaceRoom", () => {
  let server: Awaited<ReturnType<typeof createGameServer>>;
  let endpoint = "";

  beforeAll(async () => {
    server = await createGameServer();
    await server.gameServer.listen(0, "127.0.0.1");
    const address = server.httpServer.address() as AddressInfo;
    endpoint = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await server.gameServer.gracefullyShutdown(false);
  });

  it("isolates selected tracks across simultaneous rooms and rejects controller overrides", async () => {
    const client = new Client(endpoint);
    const harbor = await client.create(NETWORK_CONFIG.roomType, { ...hostOptions, trackId: "harbor" });
    const canyon = await client.create(NETWORK_CONFIG.roomType, { ...hostOptions, trackId: "canyon" });
    harbor.onMessage("*", () => undefined);
    canyon.onMessage("*", () => undefined);
    let phone: Room | undefined;
    try {
      await expect(client.create(NETWORK_CONFIG.roomType, { ...hostOptions, trackId: "unknown" })).rejects.toBeTruthy();
      await expect(client.joinById(harbor.roomId, { ...playerOptions(0), trackId: "canyon" })).rejects.toBeTruthy();
      phone = await client.joinById(harbor.roomId, playerOptions(0));
      phone.onMessage("*", () => undefined);
      for (const [room, id] of [[harbor, "harbor"], [canyon, "canyon"], [phone, "harbor"]] as const) {
        const status = nextMessage<RoomStatusMessage>(room, ROOM_MESSAGE.roomStatus);
        const snapshot = nextMessage<RaceSnapshot>(room, ROOM_MESSAGE.snapshot);
        room.send(ROOM_MESSAGE.requestStatus);
        expect((await status).trackId).toBe(id);
        expect((await snapshot).trackId).toBe(id);
      }
    } finally {
      await phone?.leave();
      await harbor.leave();
      await canyon.leave();
    }
  });

  it.each(["solo-keyboard", "solo-phone"] as const)("restricts %s to one human, owns input and cleans up the host", async (mode) => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, { ...hostOptions, mode, characterId: "lumi" });
    host.onMessage("*", () => undefined);
    let phone: Room | undefined;
    try {
      if (mode === "solo-phone") {
        phone = await client.joinById(host.roomId, playerOptions(0));
        phone.onMessage("*", () => undefined);
      }
      const statusPromise = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus);
      host.send(ROOM_MESSAGE.requestStatus);
      const status = await statusPromise;
      expect(status.mode).toBe(mode);
      expect(new Set(status.players.map(player => player.characterId)).size).toBe(4);
      expect(status.players.find(player => !player.isBot)?.characterId).toBe(mode === "solo-keyboard" ? "lumi" : "dodo");
      expect(status.players.filter((player) => player.isBot)).toHaveLength(3);
      expect(status.players.filter((player) => !player.isBot)).toHaveLength(1);
      expect(status.canStart).toBe(mode === "solo-keyboard");
      await expect(client.joinById(host.roomId, { ...playerOptions(1), color: undefined })).rejects.toBeTruthy();
      if (phone) {
        const ready = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus, (message) => message.canStart);
        phone.send(ROOM_MESSAGE.playerReady, { ready: true });
        await ready;
        const rejected = nextMessage<ProtocolErrorMessage>(host, ROOM_MESSAGE.protocolError);
        host.send(ROOM_MESSAGE.input, { sequence: 0, sentAt: 1, input: { throttle: 1, brake: 0, steer: 0, drift: false } });
        expect((await rejected).code).toBe("unauthorized");
      }
      const driver = phone ?? host;
      const acknowledged = nextMessage<InputAppliedMessage>(driver, ROOM_MESSAGE.inputApplied);
      driver.send(ROOM_MESSAGE.input, { sequence: 0, sentAt: 1, playerId: "cpu-1", input: { throttle: 1, brake: 0, steer: 0, drift: false } });
      await acknowledged;
      const countdown = nextMessage<RaceSnapshot>(host, ROOM_MESSAGE.snapshot, (message) => message.phase === "countdown");
      host.send(ROOM_MESSAGE.startRace);
      expect((await countdown).players).toHaveLength(4);
    } finally { await Promise.all([host.leave(), phone?.leave()]); }
    await expect(client.joinById(host.roomId, playerOptions(0))).rejects.toBeTruthy();
  });

  it("broadcasts independent character choices in lobby and snapshots and rejects unknown IDs", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, { ...hostOptions, hostPlays: true, characterId: "bibo" });
    host.onMessage("*", () => undefined);
    let phone: Room | undefined;
    try {
      await expect(client.joinById(host.roomId, { ...playerOptions(1), characterId: "unknown" })).rejects.toBeTruthy();
      phone = await client.joinById(host.roomId, { ...playerOptions(1), characterId: "lili" });
      phone.onMessage("*", () => undefined);
      const status = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus);
      const snapshot = nextMessage<RaceSnapshot>(host, ROOM_MESSAGE.snapshot);
      host.send(ROOM_MESSAGE.requestStatus);
      // Snapshot order follows ranking, not join order; verify identity-to-character bindings.
      const expectedCharacters = { [host.sessionId]: "bibo", [phone.sessionId]: "lili" };
      expect(Object.fromEntries((await status).players.map(player => [player.id, player.characterId]))).toEqual(expectedCharacters);
      expect(Object.fromEntries((await snapshot).players.map(player => [player.id, player.characterId]))).toEqual(expectedCharacters);
    } finally { await phone?.leave(); await host.leave(); }
  });

  it("counts a playing host in the four seats and accepts only owned driver input", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, { ...hostOptions, hostPlays: true });
    host.onMessage("*", () => undefined);
    const players: Room[] = [];
    try {
      for (let index = 1; index < 4; index += 1) {
        const player = await client.joinById(host.roomId, playerOptions(index));
        player.onMessage("*", () => undefined);
        players.push(player);
      }
      const statusPromise = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus);
      host.send(ROOM_MESSAGE.requestStatus);
      const status = await statusPromise;
      expect(status.players).toHaveLength(4);
      expect(status.players.find((player) => player.id === host.sessionId)?.ready).toBe(true);
      expect(status.canStart).toBe(false);
      await expect(client.joinById(host.roomId, { ...playerOptions(0), color: undefined })).rejects.toBeTruthy();
      const ready = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus, (message) => message.canStart);
      players.forEach((player) => player.send(ROOM_MESSAGE.playerReady, { ready: true }));
      await ready;
      const countdown = nextMessage<RaceSnapshot>(host, ROOM_MESSAGE.snapshot, (message) => message.phase === "countdown");
      host.send(ROOM_MESSAGE.startRace);
      expect((await countdown).players.map((player) => player.id)).toContain(host.sessionId);
      const applied = nextMessage<InputAppliedMessage>(host, ROOM_MESSAGE.inputApplied);
      host.send(ROOM_MESSAGE.input, { sequence: 0, sentAt: 1, input: { throttle: 1, brake: 0, steer: 0, drift: false } });
      await applied;
      const unauthorized = nextMessage<ProtocolErrorMessage>(players[0], ROOM_MESSAGE.protocolError);
      players[0].send(ROOM_MESSAGE.startRace);
      expect((await unauthorized).code).toBe("unauthorized");
    } finally {
      await Promise.all(players.map((player) => player.leave()));
      await host.leave();
    }
  });

  it("removes CPU seats when the solo phone leaves the lobby and accepts a replacement", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, { ...hostOptions, mode: "solo-phone" });
    host.onMessage("*", () => undefined);
    const phone = await client.joinById(host.roomId, playerOptions(0));
    phone.onMessage("*", () => undefined);
    const empty = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus, (message) => message.players.length === 0);
    await phone.leave();
    expect((await empty).canStart).toBe(false);
    const replacement = await client.joinById(host.roomId, playerOptions(2));
    replacement.onMessage("*", () => undefined);
    const refilled = nextMessage<RoomStatusMessage>(host, ROOM_MESSAGE.roomStatus);
    host.send(ROOM_MESSAGE.requestStatus);
    expect((await refilled).players).toHaveLength(4);
    await Promise.all([host.leave(), replacement.leave()]);
  });

  it("admits two to four distinct players and rejects a fifth player", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, hostOptions);
    const players: Room[] = [];
    for (let index = 0; index < NETWORK_CONFIG.maximumPlayers; index += 1) {
      players.push(await client.joinById(host.roomId, playerOptions(index)));
    }

    const statusPromise = nextMessage<RoomStatusMessage>(
      host,
      ROOM_MESSAGE.roomStatus,
      (status) => status.players.length === 4,
    );
    host.send(ROOM_MESSAGE.requestStatus);
    await expect(statusPromise).resolves.toMatchObject({
      phase: "lobby",
      canStart: false,
      players: PLAYER_COLORS.map((color, index) => ({
        nickname: `Driver ${index + 1}`,
        color,
        ready: false,
      })),
    });

    await expect(
      client.joinById(host.roomId, {
        ...playerOptions(0),
        nickname: "Fifth",
        color: undefined,
      }),
    ).rejects.toBeTruthy();

    await Promise.all(players.map((player) => player.leave()));
    await host.leave();
  });

  it("rejects host item use, malformed requests, lobby use and controller rematches", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, hostOptions);
    const player = await client.joinById(host.roomId, playerOptions(0));
    try {
      const unauthorized = nextMessage<ProtocolErrorMessage>(host, ROOM_MESSAGE.protocolError);
      host.send(ROOM_MESSAGE.useItem, { revision: 1, playerId: player.sessionId });
      await expect(unauthorized).resolves.toMatchObject({ code: "unauthorized" });
      const invalid = nextMessage<ProtocolErrorMessage>(player, ROOM_MESSAGE.protocolError);
      player.send(ROOM_MESSAGE.useItem, { revision: -1 });
      await expect(invalid).resolves.toMatchObject({ code: "invalid-input" });
      const unavailable = nextMessage<ProtocolErrorMessage>(player, ROOM_MESSAGE.protocolError);
      player.send(ROOM_MESSAGE.useItem, { revision: 0 });
      await expect(unavailable).resolves.toMatchObject({ code: "room-state" });
      const rematch = nextMessage<ProtocolErrorMessage>(player, ROOM_MESSAGE.protocolError);
      player.send(ROOM_MESSAGE.rematch);
      await expect(rematch).resolves.toMatchObject({ code: "unauthorized" });
    } finally { await player.leave(); await host.leave(); }
  });

  it("requires every player to be ready and only lets the host start", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, hostOptions);
    const first = await client.joinById(host.roomId, playerOptions(0));
    const second = await client.joinById(host.roomId, playerOptions(1));

    const unauthorized = nextMessage<ProtocolErrorMessage>(first, ROOM_MESSAGE.protocolError);
    first.send(ROOM_MESSAGE.startRace);
    await expect(unauthorized).resolves.toMatchObject({ code: "unauthorized" });

    const notReady = nextMessage<ProtocolErrorMessage>(host, ROOM_MESSAGE.protocolError);
    host.send(ROOM_MESSAGE.startRace);
    await expect(notReady).resolves.toMatchObject({ code: "not-ready" });

    first.send(ROOM_MESSAGE.playerReady, { ready: true });
    const canStart = nextMessage<RoomStatusMessage>(
      host,
      ROOM_MESSAGE.roomStatus,
      (status) => status.canStart,
    );
    second.send(ROOM_MESSAGE.playerReady, { ready: true });
    await expect(canStart).resolves.toMatchObject({ canStart: true });

    const countdown = nextMessage<RaceSnapshot>(
      host,
      ROOM_MESSAGE.snapshot,
      (snapshot) => snapshot.phase === "countdown",
    );
    host.send(ROOM_MESSAGE.startRace);
    await expect(countdown).resolves.toMatchObject({
      phase: "countdown",
      players: [{ status: "racing" }, { status: "racing" }],
    });

    await first.leave();
    await second.leave();
    await host.leave();
  });

  it("validates ordered input, acknowledges the server tick, and blocks host input", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, hostOptions);
    const controller = await client.joinById(host.roomId, playerOptions(0));
    const packet = {
      sequence: 1,
      sentAt: Date.now(),
      input: { throttle: 1, brake: 0, steer: 0, drift: false },
    };

    const unauthorized = nextMessage<ProtocolErrorMessage>(host, ROOM_MESSAGE.protocolError);
    host.send(ROOM_MESSAGE.input, packet);
    await expect(unauthorized).resolves.toMatchObject({ code: "unauthorized" });

    const acknowledgement = nextMessage<InputAppliedMessage>(controller, ROOM_MESSAGE.inputApplied);
    controller.send(ROOM_MESSAGE.input, packet);
    await expect(acknowledgement).resolves.toMatchObject({
      sequence: 1,
      sentAt: packet.sentAt,
    });

    const duplicate = nextMessage<ProtocolErrorMessage>(controller, ROOM_MESSAGE.protocolError);
    controller.send(ROOM_MESSAGE.input, packet);
    await expect(duplicate).resolves.toMatchObject({ code: "rate-limited" });

    await controller.leave();
    await host.leave();
  });

  it("keeps each player's authoritative input isolated", async () => {
    const client = new Client(endpoint);
    const host = await client.create(NETWORK_CONFIG.roomType, hostOptions);
    const first = await client.joinById(host.roomId, playerOptions(0));
    const second = await client.joinById(host.roomId, playerOptions(1));
    first.send(ROOM_MESSAGE.playerReady, { ready: true });
    second.send(ROOM_MESSAGE.playerReady, { ready: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    host.send(ROOM_MESSAGE.startRace);

    await nextMessage<RaceSnapshot>(
      host,
      ROOM_MESSAGE.snapshot,
      (snapshot) => snapshot.phase === "racing",
      4_500,
    );

    let sequence = 0;
    const timer = setInterval(() => {
      first.send(ROOM_MESSAGE.input, {
        sequence,
        sentAt: Date.now(),
        input: { throttle: 1, brake: 0, steer: 0, drift: false },
      });
      sequence += 1;
    }, 50);
    const moving = await nextMessage<RaceSnapshot>(
      host,
      ROOM_MESSAGE.snapshot,
      (snapshot) => {
        const firstPlayer = snapshot.players.find((player) => player.id === first.sessionId);
        const secondPlayer = snapshot.players.find((player) => player.id === second.sessionId);
        return snapshot.elapsedTime > 0.4 && (firstPlayer?.speed ?? 0) - (secondPlayer?.speed ?? 0) > 2;
      },
      2_000,
    );
    clearInterval(timer);
    expect(moving.players.find((player) => player.id === first.sessionId)?.speed).toBeGreaterThan(2);
    // Both racers receive launch turbo; only the first receives throttle.
    expect(moving.players.find((player) => player.id === first.sessionId)!.speed -
      moving.players.find((player) => player.id === second.sessionId)!.speed).toBeGreaterThan(2);

    await first.leave();
    await second.leave();
    await host.leave();
  }, 8_000);
});
