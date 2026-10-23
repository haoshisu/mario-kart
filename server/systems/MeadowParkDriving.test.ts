import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { SimulationSystem } from "./SimulationSystem";
import { botInput } from "./BotDriver";
import type { RaceRouteSample } from "../../src/game/core/race/raceTrack";
import type { TrackSample } from "../../src/game/track/trackPath";
import { sampleTrackSurface } from "../../src/game/track/trackSurface";
import { sampleAtDistance } from "../../src/game/track/trackPlacement";
import { MEADOW_PARK_LANDMARKS } from "../../src/game/track/meadowPark";
import { createParkObstacle, parkObstaclePose, PARK_OBSTACLE_CONFIG } from "../../src/game/track/parkObstacle";

beforeAll(async () => { await RAPIER.init(); });
const DRIVER = "driver";
function ready() {
  const simulation = new SimulationSystem(42, "meadow");
  simulation.addPlayer(DRIVER, "Driver", "coral");
  simulation.start();
  for (let tick = 0; tick < 190; tick++) simulation.step(tick * 1000 / 60);
  return simulation;
}
function setInitialPose(simulation: SimulationSystem, point: TrackSample, lane = 0) {
  const x = point.position[0] + point.normal[0] * lane;
  const z = point.position[1] + point.normal[1] * lane;
  simulation.resetPlayerPose(DRIVER, [x, point.height + Math.tan(point.bank) * lane + .52, z], Math.atan2(-point.tangent[0], -point.tangent[1]));
}
function drive(simulation: SimulationSystem, route: readonly RaceRouteSample[], lane = 0) {
  const now = simulation.getTick() * 1000 / 60;
  const player = simulation.getSnapshot().players[0];
  const input = botInput(player.position[0], player.position[2], player.yaw, player.speed, lane, [], route, [], player.position[1] - .52);
  simulation.input.receive(DRIVER, { sequence: simulation.getTick(), sentAt: now, input }, now);
  simulation.step(now);
  return simulation.getSnapshot().players[0];
}
function asRoute(samples: readonly TrackSample[]): RaceRouteSample[] {
  let distance = 0;
  return samples.map((sample, i) => {
    if (i) distance += Math.hypot(sample.position[0] - samples[i - 1].position[0], sample.position[1] - samples[i - 1].position[1]);
    return { ...sample, distance, raceProgress: i / samples.length };
  });
}

describe("Meadow park authoritative driving", () => {
  it("drives a legal full lap on the main road past the shortcut merge without a deck barrier", () => {
    const simulation = new SimulationSystem(42, "meadow");
    try {
      simulation.addPlayer(DRIVER, "Driver", "coral");
      simulation.start();
      // Keep the ordinary spawn and main route throughout. Shortcut routing,
      // pose resets and reversing recovery would hide the merge's deck wall.
      const main = simulation.track.race.RACE_ROUTE_SAMPLES;
      let passedMerge = false, minimumMergeSpeed = Infinity;
      for (let tick = 0; tick < 120 * 60; tick++) {
        const player = drive(simulation, main);
        const lapFraction = player.raceFraction * player.totalLaps - player.completedLaps;
        if (player.completedLaps === 0 && lapFraction >= .605 && lapFraction <= .625) {
          minimumMergeSpeed = Math.min(minimumMergeSpeed, player.speed);
          const surface = sampleTrackSurface(player.position[0], player.position[2], main, undefined, { height: player.position[1] - .52 });
          expect(surface.distance).toBeLessThan(1.5);
        }
        if (player.completedLaps === 0 && lapFraction >= .67) passedMerge = true;
        if (player.completedLaps >= 1) break;
      }
      const player = simulation.getSnapshot().players[0];
      expect(passedMerge, JSON.stringify(player)).toBe(true);
      expect(minimumMergeSpeed, "main-road centreline must not stall against the branch deck").toBeGreaterThan(6);
      expect(player.completedLaps, JSON.stringify(player)).toBe(1);
      expect(player.impactRevision).toBe(0);
    } finally { simulation.dispose(); }
  });

  it.each(["bridge", "underpass"] as const)("crosses the shared XZ junction on the %s without switching road layers", layer => {
    const simulation = ready();
    try {
      const route = simulation.track.race.RACE_ROUTE_SAMPLES;
      const crossing = MEADOW_PARK_LANDMARKS.valley.position;
      const candidates = route.filter(sample => layer === "bridge" ? sample.height > 12 : sample.height < 5);
      const target = candidates.reduce((a, b) => Math.hypot(a.position[0] - crossing[0], a.position[1] - crossing[2]) < Math.hypot(b.position[0] - crossing[0], b.position[1] - crossing[2]) ? a : b);
      setInitialPose(simulation, sampleAtDistance(route, target.distance - 20));
      let crossed = false, exited = false;
      for (let step = 0; step < 420; step++) {
        const player = drive(simulation, route);
        const distance = Math.hypot(player.position[0] - crossing[0], player.position[2] - crossing[2]);
        if (distance < 4) {
          crossed = true;
          expect(player.position[1]).toBeCloseTo(target.height + .52, 1);
          expect(player.stuntProgress).toBe(0);
        }
        if (crossed && distance > 12) { exited = true; break; }
      }
      expect(crossed).toBe(true);
      expect(exited).toBe(true);
      expect(simulation.getSnapshot().players[0].impactRevision).toBe(0);
    } finally { simulation.dispose(); }
  });

  it("drives from the main road through the narrow shortcut and merges using ordinary input", () => {
    const simulation = ready();
    try {
      const main = simulation.track.race.RACE_ROUTE_SAMPLES, branch = simulation.track.branches[0];
      const before = main.filter(sample => sample.raceProgress >= branch.entryProgress - .04 && sample.raceProgress < branch.entryProgress);
      const after = main.filter(sample => sample.raceProgress > branch.exitProgress && sample.raceProgress <= branch.exitProgress + .07);
      const route = asRoute([...before, ...branch.samples, ...after]);
      setInitialPose(simulation, before[0]);
      let interior = false, merged = false;
      const middle = branch.samples[Math.floor(branch.samples.length / 2)], exit = after[12];
      for (let step = 0; step < 900; step++) {
        const player = drive(simulation, route);
        const [x, y, z] = player.position;
        if (Math.hypot(x - middle.position[0], z - middle.position[1]) < 5) {
          interior = true;
          const surface = sampleTrackSurface(x, z, branch.samples, undefined, { closed: false, height: y - .52 });
          expect(surface.distance).toBeLessThan(branch.width / 2);
          expect(y).toBeCloseTo(surface.height + .52, 2);
          expect(sampleTrackSurface(x, z, main, undefined, { height: y - .52 }).distance).toBeGreaterThan(4.2);
        }
        if (interior && Math.hypot(x - exit.position[0], z - exit.position[1]) < 5) { merged = true; break; }
      }
      expect(interior).toBe(true);
      expect(merged).toBe(true);
      expect(simulation.getSnapshot().players[0].impactRevision).toBe(0);
    } finally { simulation.dispose(); }
  });

  it("the moving gardener is a real collision while a central racing line can pass", () => {
    function approach(lane: number, phaseOffset = 0) {
      const simulation = ready();
      try {
        // Shift the obstacle's phase before the one allowed initial pose reset.
        for (let wait = 0; wait < phaseOffset * 60; wait++) simulation.step(simulation.getTick() * 1000 / 60);
        const route = simulation.track.race.RACE_ROUTE_SAMPLES;
        const obstacle = createParkObstacle(route);
        setInitialPose(simulation, sampleAtDistance(route, obstacle.sample.distance - 15), lane);
        let speedBeforeImpact = 0, speedAfterImpact = Infinity, collided = false, passed = false;
        let closestObstacle = Infinity, impactDistance = Infinity, roadDistanceAtImpact = Infinity;
        for (let step = 0; step < 420; step++) {
          const previous = simulation.getSnapshot().players[0];
          const pose = parkObstaclePose(obstacle, (simulation.getTick() + 1) / 60);
          const player = drive(simulation, route, lane);
          closestObstacle = Math.min(closestObstacle, Math.hypot(player.position[0] - pose.x, player.position[2] - pose.z));
          if (!collided && player.impactRevision > previous.impactRevision) {
            expect(player.impactKind).toBe("wall");
            impactDistance = Math.hypot(player.position[0] - pose.x, player.position[2] - pose.z);
            roadDistanceAtImpact = sampleTrackSurface(player.position[0], player.position[2], route, undefined, { height: player.position[1] - .52 }).distance;
            speedBeforeImpact = previous.speed;
            speedAfterImpact = player.speed;
            collided = true;
          }
          const dx = player.position[0] - obstacle.sample.position[0], dz = player.position[2] - obstacle.sample.position[1];
          if (dx * obstacle.sample.tangent[0] + dz * obstacle.sample.tangent[1] > 8) { passed = true; break; }
        }
        return { collided, passed, speedBeforeImpact, speedAfterImpact, closestObstacle, impactDistance, roadDistanceAtImpact };
      } finally { simulation.dispose(); }
    }
    const collision = approach(PARK_OBSTACLE_CONFIG.center);
    expect(collision.collided).toBe(true);
    expect(collision.closestObstacle).toBeLessThan(2);
    expect(collision.impactDistance).toBeLessThan(2);
    expect(collision.roadDistanceAtImpact).toBeLessThan(3.4);
    expect(collision.speedBeforeImpact).toBeGreaterThan(6);
    expect(collision.speedAfterImpact).toBeLessThan(collision.speedBeforeImpact * .8);
    for (const phase of [0, .2, .4, .6, .8]) {
      const bypass = approach(0, phase * PARK_OBSTACLE_CONFIG.period);
      expect(bypass.passed, `obstacle phase ${phase}`).toBe(true);
      expect(bypass.collided, `obstacle phase ${phase}`).toBe(false);
    }
  });
});
