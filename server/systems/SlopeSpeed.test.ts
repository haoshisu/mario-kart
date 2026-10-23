import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";
import { SimulationSystem } from "./SimulationSystem";
import { botInput } from "./BotDriver";
import { getTrackData } from "../../src/game/track/trackData";
import { roadOrientation, roadQuaternion, sampleTrackSurface } from "../../src/game/track/trackSurface";
import { KART_CONFIG, KART_START } from "../../src/game/core/kart/kartConfig";
import { createInitialKartState, getKartForward, stepKartSimulation } from "../../src/game/core/kart/kartPhysics";

beforeAll(async () => { await RAPIER.init(); });

it("matches the kart-local pitch and bank presentation at every heading", () => {
  for (const yaw of [0, .4, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const bank of [-.06, 0, .06]) {
      const forward = getKartForward(yaw);
      const surface = { height: 0, distance: 0, gradientX: forward.x * .3 + Math.cos(yaw) * bank, gradientZ: forward.z * .3 - Math.sin(yaw) * bank };
      const { pitch, roll } = roadOrientation(yaw, surface);
      const expected = new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, "YXZ"));
      const result = roadQuaternion(yaw, surface);
      expect(result.x).toBeCloseTo(expected.x, 10);
      expect(result.y).toBeCloseTo(expected.y, 10);
      expect(result.z).toBeCloseTo(expected.z, 10);
      expect(result.w).toBeCloseTo(expected.w, 10);
      const up = new Vector3(0, 1, 0).applyQuaternion(expected);
      const normal = new Vector3(-surface.gradientX, 1, -surface.gradientZ).normalize();
      expect(up.dot(normal)).toBeGreaterThan(.99999);
    }
  }
});

it("maintains full-throttle authoritative speed through the banked uphill road seams", () => {
  const simulation = new SimulationSystem(42, "meadow");
  try {
    simulation.addPlayer("driver", "Driver", "coral");
    simulation.start();
    for (let tick = 0; tick < 190; tick++) simulation.step(tick * 1000 / 60);
    const route = simulation.track.race.RACE_ROUTE_SAMPLES;
    const start = route[Math.round(route.length * .08)];
    simulation.resetPlayerPose("driver", [start.position[0], start.height + KART_START.position[1], start.position[1]], Math.atan2(-start.tangent[0], -start.tangent[1]));
    let measured = 0, maximumLoss = 0;
    for (let tick = 190; tick < 510; tick++) {
      const previous = simulation.getSnapshot().players[0];
      const steer = botInput(previous.position[0], previous.position[2], previous.yaw, previous.speed, 0, [], route).steer;
      const now = tick * 1000 / 60;
      // Only borrow route steering: braking or a bot's corner speed limit
      // would hide the physics loss reported under continuous human throttle.
      simulation.input.receive("driver", { sequence: tick, sentAt: now, input: { throttle: 1, brake: 0, steer, drift: false } }, now);
      simulation.step(now);
      const player = simulation.getSnapshot().players[0];
      const surface = sampleTrackSurface(player.position[0], player.position[2], simulation.track.samples, undefined, { height: player.position[1] - KART_START.position[1] });
      if (surface.height > 2.4 && surface.height < 15.5) {
        measured++;
        maximumLoss = Math.max(maximumLoss, 17 - player.speed);
        expect(surface.distance).toBeLessThan(.3);
        expect(player.impactRevision).toBe(0);
        expect(player.stuntProgress).toBe(0);
      }
    }
    expect(measured).toBeGreaterThan(150);
    // This is the solver's velocity read-back, not a forced desired speed.
    // Previously this same legal uphill path fell from 17 to about 5 m/s.
    expect(maximumLoss).toBeLessThan(.5);
  } finally { simulation.dispose(); }
});

it("keeps the practice collider moving at commanded speed on the same real uphill mesh", () => {
  const track = getTrackData("meadow"), route = track.race.RACE_ROUTE_SAMPLES;
  const start = route[Math.round(route.length * .08)];
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    world.timestep = KART_CONFIG.fixedTimeStep;
    const mesh = track.geometry.DRIVABLE_MESH_DATA;
    world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(start.position[0], start.height + KART_START.position[1], start.position[1]).lockRotations().setLinearDamping(.05).setSoftCcdPrediction(KART_CONFIG.softCcdPrediction));
    world.createCollider(RAPIER.ColliderDesc.roundCuboid(.62 * KART_CONFIG.modelScale, .19, .9 * KART_CONFIG.modelScale, .06).setTranslation(0, -.18 + KART_CONFIG.grounding.colliderLift, 0).setFriction(0).setRestitution(0), body);
    let state = createInitialKartState(Math.atan2(-start.tangent[0], -start.tangent[1]));
    let measured = 0, maximumLoss = 0;
    for (let tick = 0; tick < 320; tick++) {
      const point = body.translation();
      const steer = botInput(point.x, point.z, state.yaw, state.speed, 0, [], route).steer;
      state = stepKartSimulation(state, { throttle: 1, brake: 0, steer, drift: false }, KART_CONFIG.fixedTimeStep).state;
      const surface = sampleTrackSurface(point.x, point.z, track.samples, undefined, { height: point.y - KART_START.position[1] });
      body.setTranslation({ x: point.x, y: surface.height + KART_START.position[1], z: point.z }, true);
      body.setRotation(roadQuaternion(state.yaw, surface), true);
      const forward = getKartForward(state.yaw);
      const vx = forward.x * state.speed, vz = forward.z * state.speed;
      body.setLinvel({ x: vx, y: vx * surface.gradientX + vz * surface.gradientZ, z: vz }, true);
      world.step();
      if (surface.height > 2.4 && surface.height < 15.5) {
        const velocity = body.linvel();
        measured++;
        maximumLoss = Math.max(maximumLoss, state.speed - (velocity.x * forward.x + velocity.z * forward.z));
        expect(surface.distance).toBeLessThan(.3);
      }
    }
    expect(measured).toBeGreaterThan(150);
    expect(maximumLoss).toBeLessThan(.3);
  } finally { world.free(); }
});
