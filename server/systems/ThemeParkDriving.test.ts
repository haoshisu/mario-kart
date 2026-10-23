import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { SimulationSystem } from "./SimulationSystem";
import { botInput } from "./BotDriver";
import { sampleAtDistance } from "../../src/game/track/trackPlacement";
import { createParkObstacle, PARK_OBSTACLE_CONFIG } from "../../src/game/track/parkObstacle";

beforeAll(async () => { await RAPIER.init(); });
for (const id of ["harbor", "canyon", "aurora", "forest", "clockwork", "volcano", "taipei", "jiufen", "kaohsiung", "alishan", "tainan", "taichung"] as const) for (const shortcut of [false, true]) {
  it(`${id} completes a legal lap via ${shortcut ? "its shortcut" : "its main road"} using ordinary input`, () => {
    const simulation = new SimulationSystem(42, id);
    try {
      simulation.addPlayer("driver", "Driver", "coral"); simulation.start();
      const main = simulation.track.race.RACE_ROUTE_SAMPLES, branch = simulation.track.branches[0];
      const middle = branch.samples[Math.floor(branch.samples.length / 2)];
      const route = shortcut ? [...main.filter(point => point.raceProgress < branch.entryProgress),
        ...branch.samples.map(point => ({ ...point, raceProgress: branch.entryProgress + point.progress * (branch.exitProgress - branch.entryProgress), distance: 0 })),
        ...main.filter(point => point.raceProgress > branch.exitProgress)] : main;
      let reached = false;
      for (let step = 0; step < 140 * 60; step++) {
        const player = simulation.getSnapshot().players[0], now = simulation.getTick() * 1000 / 60;
        const input = botInput(player.position[0], player.position[2], player.yaw, player.speed, 0, [], route, [], player.position[1] - .52);
        simulation.input.receive("driver", { sequence: simulation.getTick(), sentAt: now, input }, now); simulation.step(now);
        if (Math.hypot(player.position[0] - middle.position[0], player.position[2] - middle.position[1]) < 4) reached = true;
        if (player.completedLaps >= 1) break;
      }
      const player = simulation.getSnapshot().players[0];
      expect(player.completedLaps, JSON.stringify(player)).toBe(1);
      if (shortcut) expect(reached).toBe(true);
      expect(player.impactRevision).toBe(0);
    } finally { simulation.dispose(); }
  }, 15_000);
}

it.each(["harbor", "canyon", "aurora", "forest", "clockwork", "volcano"] as const)("%s obstacle collides on its moving lane while the centre remains passable", id => {
  const approach = (lane: number) => {
    const simulation = new SimulationSystem(42, id);
    try {
      simulation.addPlayer("driver", "Driver", "coral"); simulation.start();
      for (let step = 0; step < 190; step++) simulation.step(step * 1000 / 60);
      const route = simulation.track.race.RACE_ROUTE_SAMPLES, obstacle = createParkObstacle(route, id);
      const start = sampleAtDistance(route, obstacle.sample.distance - 15);
      simulation.resetPlayerPose("driver", [start.position[0] + start.normal[0] * lane, start.height + Math.tan(start.bank) * lane + .52,
        start.position[1] + start.normal[1] * lane], Math.atan2(-start.tangent[0], -start.tangent[1]));
      let passed = false, hit = false;
      for (let step = 0; step < 420; step++) {
        const player = simulation.getSnapshot().players[0], now = simulation.getTick() * 1000 / 60;
        hit ||= player.impactRevision > 0;
        if ((player.position[0] - obstacle.sample.position[0]) * obstacle.sample.tangent[0] + (player.position[2] - obstacle.sample.position[1]) * obstacle.sample.tangent[1] > 8) { passed = true; break; }
        const input = botInput(player.position[0], player.position[2], player.yaw, player.speed, lane, [], route, [], player.position[1] - .52);
        simulation.input.receive("driver", { sequence: simulation.getTick(), sentAt: now, input }, now); simulation.step(now);
      }
      return { passed, hit };
    } finally { simulation.dispose(); }
  };
  expect(approach(0)).toEqual({ passed: true, hit: false });
  expect(approach(PARK_OBSTACLE_CONFIG.center).hit).toBe(true);
});
