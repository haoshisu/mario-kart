import { applyRampSurface } from "../../src/game/core/stunts/stuntSystem";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { SimulationSystem } from "./SimulationSystem";
import { TRACK_IDS } from "../../src/game/track/trackCatalog";
import { sampleDrivingSurface } from "../../src/game/track/drivingSurface";
import { routeLength } from "../../src/game/track/trackPlacement";
import { sampleTrackSurface } from "../../src/game/track/trackSurface";

beforeAll(async () => { await RAPIER.init(); });
it.each(TRACK_IDS)("%s physically climbs and descends its road and completes the ground route beside optional jumps", (id) => {
  const simulation = new SimulationSystem(42, id);
  try {
    simulation.addPlayer("driver", "Driver", "coral", 0);
    simulation.start();
    let lowest = Infinity, highest = -Infinity, uphill = false, downhill = false;
    let jumps = 0, landings = 0, airborne = false;
    let previous = simulation.getSnapshot().players[0].position;
    for (let tick = 0; tick < (30 + routeLength(simulation.track.race.RACE_ROUTE_SAMPLES) * 3 / 10) * 60 && simulation.getPhase() !== "finished"; tick += 1) {
      simulation.step(tick * 1000 / 60);
      const player = simulation.getSnapshot().players[0];
      const [x, y, z] = player.position;
      const surface = applyRampSurface(x, z, simulation.track.ramps, sampleDrivingSurface(x, z, simulation.track, undefined, y - .52));
      if (player.stuntProgress > 0) {
        if (!airborne) jumps++;
        airborne = true;
        expect(y).toBeGreaterThan(surface.height + .52);
      } else {
        if (airborne) { landings++; expect(player.turboTier).toBeGreaterThanOrEqual(2); }
        airborne = false;
        // Leaving a side edge of the optional ramp can briefly fall back to
        // the ground without completing a stunt; it must stay above the road.
        expect(y - surface.height - .52).toBeGreaterThan(-.01);
        expect(y - surface.height - .52).toBeLessThan(1);
      }
      if (Math.hypot(x - previous[0], z - previous[2]) < 1) expect(Math.abs(y - previous[1]), JSON.stringify({ tick, player, previous, ramps: simulation.track.ramps })).toBeLessThan(.9);
      if (y - previous[1] > .005) uphill = true;
      if (y - previous[1] < -.005) downhill = true;
      lowest = Math.min(lowest, y); highest = Math.max(highest, y); previous = player.position;
    }
    // A centreline CPU may bypass optional side ramps; completion must never require a jump.
    expect(landings).toBe(jumps);
    expect(highest - lowest).toBeGreaterThan(4);
    expect(uphill && downhill).toBe(true);
    expect(simulation.getSnapshot().players[0]).toMatchObject({ status: "finished", completedLaps: 3 });
  } finally { simulation.dispose(); }
}, 20_000);

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

it.each(TRACK_IDS)("%s rewards deliberate side-lane launches and lands on its actual sloping road", id => {
  const simulation = new SimulationSystem(42, id);
  try {
    simulation.addPlayer("driver", "Driver", "coral");
    simulation.start();
    for (let tick = 0; tick < 190; tick++) simulation.step(tick * 1000 / 60);
    let tick = 190;
    for (const ramp of simulation.track.ramps) {
      const x = ramp.position[0] - ramp.forward[0] * 12;
      const z = ramp.position[1] - ramp.forward[1] * 12;
      simulation.resetPlayerPose("driver", [x, sampleTrackSurface(x, z, simulation.track.samples).height + .52, z], ramp.yaw);
      let launched = false, landed = false, trickAccepted = false;
      for (let step = 0; step < 240; step++, tick++) {
        const now = tick * 1000 / 60;
        const drift = id === "taipei" && launched && !trickAccepted;
        const rejection = simulation.input.receive("driver", { sequence: tick, sentAt: now, input: { throttle: 1, brake: 0, steer: 0, drift } }, now);
        if (drift && rejection === null) trickAccepted = true;
        simulation.step(now);
        const player = simulation.getSnapshot().players[0];
        if (player.stuntProgress > 0) launched = true;
        else if (launched) {
          const surface = sampleDrivingSurface(player.position[0], player.position[2], simulation.track, undefined, player.position[1] - .52);
          expect(surface.distance).toBeLessThan(4.2);
          expect(player.turboTier).toBeGreaterThanOrEqual(2);
          landed = true;
          break;
        }
      }
      expect(launched, ramp.id).toBe(true);
      expect(landed, ramp.id).toBe(true);
      // Preserve the real cooldown before approaching the next independent runway.
      for (let wait = 0; wait < 130; wait++, tick++) simulation.step(tick * 1000 / 60);
    }
  } finally { simulation.dispose(); }
});

it.each([false, true])("Taipei lands safely without trick boost when drift is held in advance: %s", held => {
  const simulation = new SimulationSystem(42, "taipei");
  try {
    simulation.addPlayer("driver", "Driver", "coral"); simulation.start();
    for (let tick = 0; tick < 190; tick++) simulation.step(tick * 1000 / 60);
    const ramp = simulation.track.ramps[0];
    const x = ramp.position[0] - ramp.forward[0] * 12, z = ramp.position[1] - ramp.forward[1] * 12;
    simulation.resetPlayerPose("driver", [x, sampleTrackSurface(x, z, simulation.track.samples).height + .52, z], ramp.yaw);
    let launched = false, landed = false;
    for (let tick = 190; tick < 430; tick++) {
      const now = tick * 1000 / 60;
      simulation.input.receive("driver", { sequence: tick, sentAt: now, input: { throttle: 1, brake: 0, steer: 0, drift: held } }, now);
      simulation.step(now);
      const player = simulation.getSnapshot().players[0];
      if (player.stuntProgress > 0) { launched = true; expect(player.stuntProgress).toBe(.001); }
      else if (launched) { expect(player.turboTier).toBe(0); landed = true; break; }
    }
    expect(launched && landed).toBe(true);
  } finally { simulation.dispose(); }
});
