import { TRACK_IDS } from "../../src/game/track/trackCatalog";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { SimulationSystem } from "./SimulationSystem";
import { botInput } from "./BotDriver";
import { BOT_CONFIG } from "./botConfig";
import { PLAYER_COLORS } from "../../src/game/network/networkConfig";

beforeAll(async () => { await RAPIER.init(); });

it("produces bounded deterministic driving intent", () => {
  const input = botInput(0, 0, 0, 17, 0);
  expect(input).toEqual(botInput(0, 0, 0, 17, 0));
  expect(Math.abs(input.steer)).toBeLessThanOrEqual(1);
  expect(input.drift).toBe(false);
  expect(input.throttle).toBeGreaterThanOrEqual(0);
  expect(input.throttle).toBeLessThanOrEqual(1);
});

it.each([...TRACK_IDS.map((trackId) => ({ trackId, seed: 42 })), { trackId: "meadow" as const, seed: 1 }, { trackId: "meadow" as const, seed: 2026 }])("three bots complete legal three-lap item races without position overrides (track $trackId, seed $seed)", ({ trackId, seed }) => {
  const simulation = new SimulationSystem(seed, trackId);
  try {
    simulation.addPlayer("human", "Player", PLAYER_COLORS[0]);
    BOT_CONFIG.laneOffsets.forEach((lane, index) => simulation.addPlayer(`cpu-${index}`, `CPU ${index}`, PLAYER_COLORS[index + 1], lane));
    simulation.start();
    const used = new Set<string>();
    for (let tick = 0; tick < 120 * 60 && simulation.getPhase() !== "finished"; tick += 1) {
      simulation.step(1000 + tick * 1000 / 60);
      if (tick % 30 === 0) for (const event of simulation.getSnapshot().items.events) {
        if (event.kind === "use") used.add(event.playerId);
      }
    }
    const snapshot = simulation.getSnapshot();
    expect(snapshot.phase, JSON.stringify(snapshot.players)).toBe("finished");
    for (const bot of snapshot.players.filter((player) => player.id.startsWith("cpu"))) {
      expect(bot, JSON.stringify(bot)).toMatchObject({ status: "finished", completedLaps: 3 });
      expect(bot.finishTime).toBeGreaterThan(10);
      expect(used.has(bot.id)).toBe(true);
    }
    expect(snapshot.players.find((player) => player.id === "human")?.status).toBe("dnf");
    simulation.returnToLobby();
    simulation.start();
    expect(simulation.getSnapshot().players.every((player) => player.completedLaps === 0 && player.item.held === null)).toBe(true);
  } finally { simulation.dispose(); }
});
