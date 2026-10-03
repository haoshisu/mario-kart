import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../createGameServer";
import { NETWORK_CONFIG, PLAYER_COLORS } from "../../src/game/network/networkConfig";
import { ROOM_MESSAGE, type RaceSnapshot } from "../../src/game/network/protocol";

function nextSnapshot(room: Room, timeoutMs = 2_000) {
  return new Promise<RaceSnapshot>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for snapshot")), timeoutMs);
    const unsubscribe = room.onMessage<RaceSnapshot>(ROOM_MESSAGE.snapshot, (snapshot) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(snapshot);
    });
    room.send(ROOM_MESSAGE.requestStatus);
  });
}

describe("RaceRoom connection load", () => {
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

  it("runs six four-player rooms with 30 live sockets and 20 Hz input", async () => {
    const client = new Client(endpoint);
    const roomCount = 6;
    const hosts: Room[] = [];
    const controllers: Room[][] = [];
    const rssBefore = process.memoryUsage().rss;
    const startedAt = performance.now();

    for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
      const host = await client.create(NETWORK_CONFIG.roomType, {
        role: "host",
        protocolVersion: NETWORK_CONFIG.protocolVersion,
      });
      hosts.push(host);
      const players: Room[] = [];
      for (let playerIndex = 0; playerIndex < NETWORK_CONFIG.maximumPlayers; playerIndex += 1) {
        const controller = await client.joinById(host.roomId, {
          role: "controller",
          nickname: `R${roomIndex + 1} P${playerIndex + 1}`,
          color: PLAYER_COLORS[playerIndex],
          protocolVersion: NETWORK_CONFIG.protocolVersion,
        });
        controller.send(ROOM_MESSAGE.playerReady, { ready: true });
        players.push(controller);
      }
      controllers.push(players);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    hosts.forEach((host) => host.send(ROOM_MESSAGE.startRace));
    for (let sequence = 0; sequence < NETWORK_CONFIG.inputRateHz * 4; sequence += 1) {
      const sentAt = Date.now();
      controllers.forEach((players) => {
        players.forEach((controller, playerIndex) => {
          controller.send(ROOM_MESSAGE.input, {
            sequence,
            sentAt,
            input: {
              throttle: 1,
              brake: 0,
              steer: playerIndex % 2 === 0 ? 0.12 : -0.12,
              drift: false,
            },
          });
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 1_000 / NETWORK_CONFIG.inputRateHz));
    }

    const snapshots = await Promise.all(hosts.map((host) => nextSnapshot(host)));
    snapshots.forEach((snapshot) => {
      expect(snapshot.players).toHaveLength(NETWORK_CONFIG.maximumPlayers);
      expect(snapshot.tick).toBeGreaterThan(NETWORK_CONFIG.simulationRateHz * 3);
      expect(snapshot.phase).toBe("racing");
    });
    expect(performance.now() - startedAt).toBeLessThan(10_000);
    expect(process.memoryUsage().rss - rssBefore).toBeLessThan(512 * 1_024 * 1_024);

    await Promise.all(controllers.flat().map((controller) => controller.leave()));
    await Promise.all(hosts.map((host) => host.leave()));
  }, 15_000);
});
