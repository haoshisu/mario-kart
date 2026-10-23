import { describe, expect, it } from "vitest";
import { createSlipstreamState, interruptSlipstream, slipstreamSnapshot, stepSlipstream, type SlipstreamRacer } from "./slipstreamSystem";

const leader: SlipstreamRacer = { id: "lead", position: [6, .52, 0], yaw: -Math.PI / 2, roadYaw: -Math.PI / 2, speed: 14, roadIndex: 0, laneOffset: 0, eligible: true, steer: 0 };
const follower: SlipstreamRacer = { ...leader, id: "follow", position: [0, .52, 0] };
const clear = () => true;
function charged() {
  const state = createSlipstreamState();
  for (let i = 0; i < 48; i++) stepSlipstream(state, follower, [leader], 1 / 60, clear);
  return state;
}

describe("slipstream pursuit", () => {
  it("requires sustained following, then a deliberate side exit rather than an automatic boost", () => {
    const state = charged();
    expect(slipstreamSnapshot(state)).toMatchObject({ charge: 1, ready: true, boostRemaining: 0 });
    for (let i = 0; i < 12; i++) stepSlipstream(state, follower, [leader], 1 / 60, clear);
    expect(state.boostRevision).toBe(0);
    stepSlipstream(state, { ...follower, position: [0, .52, 1.3], laneOffset: 1.3, steer: .3 }, [leader], 1 / 60, clear);
    expect(state).toMatchObject({ charge: 0, targetId: null, readyRemaining: 0, boostRemaining: .7, boostRevision: 1 });
    for (let i = 0; i < 20; i++) stepSlipstream(state, follower, [leader], 1 / 60, clear);
    expect(state.boostRevision).toBe(1); expect(state.charge).toBe(0);
  });
  it("supports both sides and retains a short steering tap while the car moves out", () => {
    for (const direction of [-1, 1]) {
      const state = charged();
      stepSlipstream(state, { ...follower, steer: direction * .3 }, [leader], 1 / 60, clear);
      for (let i = 0; i < 15; i++) stepSlipstream(state, follower, [leader], 1 / 60, clear);
      stepSlipstream(state, { ...follower, position: [0, .52, direction * 1.3], laneOffset: direction * 1.3 }, [leader], 1 / 60, clear);
      expect(state.boostRevision).toBe(1);
    }
  });
  it("allows a deliberate pull-out angle after charging, but cannot charge while sharply angled", () => {
    const angled = { ...follower, yaw: follower.yaw + Math.PI / 6, laneOffset: 1.3, position: [0, .52, 1.3] as const, steer: .4 };
    const ready = charged();
    stepSlipstream(ready, angled, [leader], 1 / 60, clear);
    expect(ready.boostRevision).toBe(1);
    const fresh = createSlipstreamState();
    stepSlipstream(fresh, { ...angled, laneOffset: 0 }, [leader], 1 / 60, clear);
    expect(fresh.charge).toBe(0);
    const reversing = charged();
    stepSlipstream(reversing, { ...angled, yaw: follower.yaw + Math.PI / 2 }, [leader], 1 / 60, clear);
    expect(reversing.boostRevision).toBe(0); expect(reversing.readyRemaining).toBe(0);
  });
  it("retains a committed pull-out through countersteering, then permits a new intent after expiry", () => {
    const state = charged();
    stepSlipstream(state, { ...follower, steer: .3 }, [leader], 1 / 60, clear);
    for (let i = 0; i < 15; i++) stepSlipstream(state, { ...follower, steer: -.3 }, [leader], 1 / 60, clear);
    stepSlipstream(state, { ...follower, laneOffset: 1.3, steer: -.3 }, [leader], 1 / 60, clear);
    expect(state.boostRevision).toBe(1);
    const retry = charged();
    stepSlipstream(retry, { ...follower, steer: .3 }, [leader], 1 / 60, clear);
    for (let i = 0; i < 40; i++) stepSlipstream(retry, { ...follower, steer: -.3 }, [leader], 1 / 60, clear);
    stepSlipstream(retry, { ...follower, laneOffset: -1.3, steer: -.3 }, [leader], 1 / 60, clear);
    expect(retry.boostRevision).toBe(1);
  });
  it("does not reward the leader changing lanes while the follower keeps straight", () => {
    const state = charged();
    stepSlipstream(state, follower, [{ ...leader, position: [6, .52, -1.4], laneOffset: -1.4 }], 1 / 60, clear);
    expect(state.boostRevision).toBe(0);
    for (let i = 0; i < 80; i++) stepSlipstream(state, follower, [leader], 1 / 60, clear);
    expect(state.readyRemaining).toBe(0); expect(state.charge).toBe(0); expect(state.boostRevision).toBe(0);
  });
  it("discards an earlier exit tap when losing the target and charging behind another car", () => {
    const state = charged();
    stepSlipstream(state, { ...follower, steer: .3 }, [leader], 1 / 60, clear);
    stepSlipstream(state, follower, [], 1 / 60, clear);
    expect(state.exitIntentRemaining).toBe(0);
    const next = { ...leader, id: "next" };
    for (let i = 0; i < 48; i++) stepSlipstream(state, follower, [next], 1 / 60, clear);
    expect(state.readyRemaining).toBeGreaterThan(0);
    stepSlipstream(state, follower, [{ ...next, position: [6, .52, -1.4], laneOffset: -1.4 }], 1 / 60, clear);
    expect(state.boostRevision).toBe(0);
  });
  it("requires the follower to change its own road-relative lane even while steering through a bend", () => {
    const state = charged();
    stepSlipstream(state, { ...follower, steer: .3 }, [{ ...leader, laneOffset: -1.4, yaw: leader.yaw + .1, roadYaw: leader.roadYaw + .1 }], 1 / 60, clear);
    expect(state.boostRevision).toBe(0);
    stepSlipstream(state, { ...follower, steer: .3, laneOffset: .7 }, [{ ...leader, laneOffset: -1.4 }], 1 / 60, clear);
    expect(state.boostRevision).toBe(1);
  });
  it.each([
    { ...leader, position: [2.5, .52, 0] as const },
    { ...leader, position: [11, .52, 0] as const },
    { ...leader, position: [6, .52, 1.3] as const, laneOffset: 1.3 },
    { ...leader, position: [6, 13.52, 0] as const },
    { ...leader, roadIndex: 1 },
    { ...leader, roadYaw: 0 },
    { ...leader, yaw: Math.PI / 2 },
    { ...leader, speed: 7 },
    { ...leader, eligible: false },
  ])("rejects incompatible geometry or an inactive target: %j", candidate => {
    const state = createSlipstreamState();
    for (let i = 0; i < 60; i++) stepSlipstream(state, follower, [candidate], 1 / 60, clear);
    expect(state.charge).toBe(0); expect(state.readyRemaining).toBe(0);
  });
  it("resets when obstructed, losing the target, changing targets or leaving the tail early", () => {
    const state = createSlipstreamState();
    for (let i = 0; i < 30; i++) stepSlipstream(state, follower, [leader], 1 / 60, clear);
    stepSlipstream(state, follower, [{ ...leader, id: "another" }], 1 / 60, clear);
    expect(state.charge).toBeCloseTo(1 / 60);
    stepSlipstream(state, follower, [leader], 1 / 60, () => false);
    expect(state.charge).toBe(0);
    const ready = charged(); stepSlipstream(ready, follower, [], 1 / 60, clear);
    expect(ready.readyRemaining).toBe(0);
    stepSlipstream(state, { ...follower, position: [0, .52, 1.3], laneOffset: 1.3, steer: .3 }, [leader], 1 / 60, clear);
    expect(state.boostRevision).toBe(0);
  });
  it("interrupts readiness and an active boost without reusing the consumed reward", () => {
    const state = charged();
    stepSlipstream(state, { ...follower, position: [0, .52, 1.3], laneOffset: 1.3, steer: .3 }, [leader], 1 / 60, clear);
    interruptSlipstream(state);
    expect(state).toMatchObject({ boostRemaining: 0, charge: 0, readyRemaining: 0, boostRevision: 1 });
    stepSlipstream(state, follower, [leader], 1 / 60, clear);
    expect(state.charge).toBe(0);
    const ready = charged(); stepSlipstream(ready, { ...follower, eligible: false }, [leader], 1 / 60, clear);
    expect(ready.readyRemaining).toBe(0);
  });
  it("charges and expires by elapsed time at 30, 60 and 120 Hz", () => {
    for (const rate of [30, 60, 120]) {
      const state = createSlipstreamState();
      for (let i = 0; i < rate * .8; i++) stepSlipstream(state, follower, [leader], 1 / rate, clear);
      expect(state.readyRemaining).toBe(1.2);
      stepSlipstream(state, { ...follower, position: [0, .52, 1.3], laneOffset: 1.3, steer: .3 }, [leader], 1 / rate, clear);
      for (let i = 0; i < Math.ceil(rate * .7); i++) stepSlipstream(state, follower, [leader], 1 / rate, clear);
      expect(state.boostRemaining).toBeLessThan(1e-8); expect(state.boostRevision).toBe(1);
    }
  });
});
