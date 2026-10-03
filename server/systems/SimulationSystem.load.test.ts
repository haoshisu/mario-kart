import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { NETWORK_CONFIG, PLAYER_COLORS } from "../../src/game/network/networkConfig";
import { SimulationSystem } from "./SimulationSystem";

describe("SimulationSystem multiplayer load", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("sustains several four-player rooms without losing fixed ticks", () => {
    const rooms = Array.from({ length: 6 }, () => new SimulationSystem());
    rooms.forEach((room, roomIndex) => {
      PLAYER_COLORS.forEach((color, playerIndex) => {
        room.addPlayer(`${roomIndex}-${playerIndex}`, `Driver ${playerIndex + 1}`, color);
      });
      room.start();
    });

    const tickCount = NETWORK_CONFIG.simulationRateHz * 4;
    let now = 10_000;
    let sequence = 0;
    const startedAt = performance.now();
    for (let tick = 0; tick < tickCount; tick += 1) {
      now += 1_000 / NETWORK_CONFIG.simulationRateHz;
      rooms.forEach((room, roomIndex) => {
        if (tick % (NETWORK_CONFIG.simulationRateHz / NETWORK_CONFIG.inputRateHz) === 0) {
          PLAYER_COLORS.forEach((_color, playerIndex) => {
            room.input.receive(`${roomIndex}-${playerIndex}`, {
              sequence,
              sentAt: now,
              input: {
                throttle: 1,
                brake: 0,
                steer: playerIndex % 2 === 0 ? 0.15 : -0.15,
                drift: false,
              },
            }, now);
          });
          sequence += 1;
        }
        room.step(now);
      });
    }
    const duration = performance.now() - startedAt;

    rooms.forEach((room) => {
      expect(room.getTick()).toBe(tickCount);
      expect(room.getSnapshot(now).players).toHaveLength(4);
      room.dispose();
    });
    expect(duration).toBeLessThan(5_000);
  });
});
