import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { SimulationSystem } from "./SimulationSystem";
import { SlipstreamSystem } from "./SlipstreamSystem";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import type { SlipstreamRacer } from "../../src/game/core/kart/slipstreamSystem";

beforeAll(async () => { await RAPIER.init(); });

function race(cpu = false) {
  const simulation = new SimulationSystem(42);
  simulation.addPlayer("lead", "Lead", "coral"); simulation.addPlayer("follow", "Follow", "sun", cpu ? 0 : undefined);
  simulation.start();
  while (simulation.getPhase() === "countdown") simulation.step(1000 + simulation.getTick() * 1000 / 60);
  simulation.resetPlayerPose("lead", [-20, .52, -10.5], -Math.PI / 2);
  simulation.resetPlayerPose("follow", [-26, .52, -10.5], -Math.PI / 2);
  const advance = (steer = 0, exit = false, brakeLead = false) => {
    const tick = simulation.getTick(), now = 1000 + tick * 1000 / 60;
    const before = simulation.getSnapshot(now);
    if (tick % 3 === 0) for (const id of ["lead", "follow"]) {
      const player = before.players.find(player => player.id === id)!;
      simulation.input.receive(id, { sequence: tick, sentAt: now,
        input: { throttle: id === "follow" && exit ? 1 : player.speed < 14.2 ? 1 : 0,
          brake: id === "lead" && brakeLead ? 1 : 0, steer: id === "follow" ? steer : 0, drift: false } }, now);
    }
    simulation.step(now);
    return simulation.getSnapshot(now).players.find(player => player.id === "follow")!;
  };
  return { simulation, advance };
}

describe("authoritative slipstream", () => {
  it("earns a separate boost through real following and steering without consuming an item or drift tier", () => {
    const { simulation, advance } = race();
    try {
      let ready = false;
      for (let tick = 0; tick < 150; tick++) if (advance().slipstream.ready) { ready = true; break; }
      expect(ready).toBe(true);
      for (let tick = 0; tick < 13; tick++) advance(.4, true);
      let boosted = false, maximumSpeed = 0;
      for (let tick = 0; tick < 65; tick++) {
        const player = advance(0, true); maximumSpeed = Math.max(maximumSpeed, player.speed);
        if (player.slipstream.boostRemaining > 0) {
          boosted = true; expect(player.slipstream.boostRevision).toBe(1);
          expect(player.turboTier).toBe(0); expect(player.item.boostRemaining).toBe(0);
        }
      }
      expect(boosted).toBe(true); expect(maximumSpeed).toBeGreaterThan(18);
      expect(simulation.getSnapshot().players.find(player => player.id === "follow")?.slipstream.boostRemaining).toBe(0);
    } finally { simulation.dispose(); }
  });
  it("lets the CPU follow and pull out through the same input and reward rules", () => {
    const { simulation, advance } = race(true);
    try {
      let charged = false, boosted = false;
      for (let tick = 0; tick < 240; tick++) {
        const player = advance(); charged ||= player.slipstream.ready;
        boosted ||= player.slipstream.boostRevision > 0;
        if (boosted) break;
      }
      expect(charged).toBe(true); expect(boosted).toBe(true);
    } finally { simulation.dispose(); }
  });
  it("clears an earned opportunity on disconnect, pose reset and a new race", () => {
    const { simulation, advance } = race();
    try {
      for (let tick = 0; tick < 150 && !simulation.getSnapshot().players.find(player => player.id === "follow")?.slipstream.ready; tick++) advance();
      expect(simulation.getSnapshot().players.find(player => player.id === "follow")?.slipstream.ready).toBe(true);
      simulation.setConnection("follow", "reconnecting");
      expect(simulation.getSnapshot().players.find(player => player.id === "follow")?.slipstream).toEqual({ charge: 0, ready: false, boostRemaining: 0, boostRevision: 0 });
      simulation.setConnection("follow", "connected");
      simulation.resetPlayerPose("follow", [-26, .52, -10.5], -Math.PI / 2);
      simulation.returnToLobby(); simulation.start();
      expect(simulation.getSnapshot().players.every(player => player.slipstream.charge === 0 && player.slipstream.boostRevision === 0)).toBe(true);
    } finally { simulation.dispose(); }
  });
  it("loses charge before and during a real rear collision after the leader brakes", () => {
    const { simulation, advance } = race();
    try {
      for (let tick = 0; tick < 150 && !simulation.getSnapshot().players.find(player => player.id === "follow")?.slipstream.ready; tick++) advance();
      let collision = false;
      for (let tick = 0; tick < 120; tick++) {
        const player = advance(0, true, true);
        if (player.impactKind === "kart" && player.impactRevision > 0) {
          collision = true; expect(player.slipstream).toMatchObject({ charge: 0, ready: false, boostRemaining: 0 }); break;
        }
      }
      expect(collision).toBe(true);
    } finally { simulation.dispose(); }
  });
  it("uses the live physics obstacle positions to block a tail even with compatible geometry", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }), system = new SlipstreamSystem();
    try {
      const from: SlipstreamRacer = { id: "follow", position: [0, .52, 0], yaw: -Math.PI / 2, roadYaw: -Math.PI / 2, speed: 14, roadIndex: 0, laneOffset: 0, eligible: true, steer: 0 };
      const to = { ...from, id: "lead", position: [6, .52, 0] as const };
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(3, .52, 0));
      world.createCollider(RAPIER.ColliderDesc.cuboid(.3, 1, 1).setCollisionGroups(NETWORK_CONFIG.collision.groups.road), body);
      world.step(); expect(system.clear(world, from, to)).toBe(false);
      body.setNextKinematicTranslation({ x: 3, y: .52, z: 5 }); world.step();
      expect(system.clear(world, from, to)).toBe(true);
    } finally { world.free(); }
  });
});
