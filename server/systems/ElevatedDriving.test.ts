import { applyRampSurface } from "../../src/game/core/stunts/stuntSystem";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { SimulationSystem } from "./SimulationSystem";
import { TRACK_IDS } from "../../src/game/track/trackCatalog";
import { sampleTrackSurface } from "../../src/game/track/trackSurface";

beforeAll(async () => { await RAPIER.init(); });
it.each(TRACK_IDS)("%s physically climbs and descends its road including physical stunt jumps and rewarded landings", (id) => {
  const simulation = new SimulationSystem(42, id);
  try {
    simulation.addPlayer("driver", "Driver", "coral", 0);
    simulation.start();
    let lowest = Infinity, highest = -Infinity, uphill = false, downhill = false;
    let jumps = 0, landings = 0, airborne = false;
    let previous = simulation.getSnapshot().players[0].position;
    for (let tick = 0; tick < 150 * 60 && simulation.getPhase() !== "finished"; tick += 1) {
      simulation.step(tick * 1000 / 60);
      const player = simulation.getSnapshot().players[0];
      const [x, y, z] = player.position;
      const surface = applyRampSurface(x, z, simulation.track.ramps, sampleTrackSurface(x, z, simulation.track.samples));
      if (player.stuntProgress > 0) {
        if (!airborne) jumps++;
        airborne = true;
        expect(y).toBeGreaterThan(surface.height + .52);
      } else {
        if (airborne) { landings++; expect(player.turboTier).toBe(2); }
        airborne = false;
        expect(y).toBeCloseTo(surface.height + .52, 3);
      }
      if (Math.hypot(x - previous[0], z - previous[2]) < 1) expect(Math.abs(y - previous[1]), JSON.stringify({ tick, player, previous, ramps: simulation.track.ramps })).toBeLessThan(.4);
      if (y - previous[1] > .02) uphill = true;
      if (y - previous[1] < -.02) downhill = true;
      lowest = Math.min(lowest, y); highest = Math.max(highest, y); previous = player.position;
    }
    expect(jumps).toBeGreaterThan(0);
    expect(landings).toBe(jumps);
    expect(highest - lowest).toBeGreaterThan(4);
    expect(uphill && downhill).toBe(true);
    expect(simulation.getSnapshot().players[0]).toMatchObject({ status: "finished", completedLaps: 3 });
  } finally { simulation.dispose(); }
});

it("pushes a wall impact back onto the road even while throttle remains held", () => {
  const simulation = new SimulationSystem(42);
  try {
    simulation.addPlayer("driver", "Driver", "coral");
    simulation.start();
    for (let tick = 0; tick < 190; tick += 1) simulation.step(tick * 1000 / 60);
    simulation.resetPlayerPose("driver", [-4, .52, -11], 0);
    let impactZ: number | null = null, maximumPush = 0, reversed = false;
    for (let tick = 190; tick < 320; tick += 1) {
      const now = tick * 1000 / 60;
      simulation.input.receive("driver", { sequence: tick, sentAt: now, input: { throttle: 1, brake: 0, steer: 0, drift: false } }, now);
      simulation.step(now);
      const player = simulation.getSnapshot().players[0];
      if (player.impactRevision > 0 && impactZ === null) impactZ = player.position[2];
      if (impactZ !== null) {
        maximumPush = Math.max(maximumPush, player.position[2] - impactZ);
        reversed ||= player.speed < -1;
      }
      expect(player.spinOutRemaining).toBe(0);
    }
    expect(impactZ).not.toBeNull();
    expect(reversed).toBe(true);
    expect(maximumPush).toBeGreaterThan(.25);
  } finally { simulation.dispose(); }
});
