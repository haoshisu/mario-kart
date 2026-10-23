import { describe, expect, it } from "vitest";
import { createKartVisualDynamics, createWheelVisualDynamics, stepKartVisualDynamics, stepWheelVisualDynamics, KART_VISUAL_CONFIG, createKartSurfaceDynamics, stepKartSurfaceDynamics } from "./kartVisualDynamics";

function ramp(from: number, acceleration: number, dt: number) {
  const state = createKartVisualDynamics();
  stepKartVisualDynamics(state, from, 0, false, false, 0, dt);
  for (let frame = 1; frame <= Math.round(1 / dt); frame++) {
    stepKartVisualDynamics(state, from + acceleration * frame * dt, .7, false, false, 0, dt);
  }
  return state;
}

describe("presentation-only sprung body", () => {
  it("raises the nose under acceleration and dives under braking without displacing wheel contact", () => {
    const accelerating = ramp(0, 11, 1 / 60), braking = ramp(17, -14, 1 / 60);
    expect(accelerating.pitch).toBeGreaterThan(.025);
    expect(braking.pitch).toBeLessThan(-.025);
    expect(Math.abs(braking.pitch)).toBeLessThanOrEqual(KART_VISUAL_CONFIG.maximumPitch);
    expect(accelerating.sink).toBeCloseTo(0, 10);
    expect(accelerating.roll).toBeLessThan(0);
  });
  it("converges to the same body pose at different render rates", () => {
    const slow = ramp(0, 11, 1 / 30), fast = ramp(0, 11, 1 / 120);
    expect(slow.pitch).toBeCloseTo(fast.pitch, 3);
    expect(slow.roll).toBeCloseTo(fast.roll, 2);
  });
  it("stays still at cruising speed and settles a collision instead of vibrating every frame", () => {
    const state = createKartVisualDynamics();
    stepKartVisualDynamics(state, 17, 0, false, false, 0, 1 / 60);
    for (let frame = 0; frame < 120; frame++) stepKartVisualDynamics(state, 17, 0, false, false, 0, 1 / 60);
    expect(state.pitch).toBe(0);
    expect(state.roll).toBe(0);
    stepKartVisualDynamics(state, 17, 0, false, false, 1, 1 / 60);
    expect(state.pitch).toBeLessThan(0);
    expect(state.sink).toBeLessThan(0);
    for (let frame = 0; frame < 120; frame++) stepKartVisualDynamics(state, 17, 0, false, false, 0, 1 / 60);
    expect(Math.abs(state.pitch)).toBeLessThan(.0001);
    expect(Math.abs(state.sink)).toBeLessThan(.0001);
  });
  it("resets on teleport or a large frame gap and suppresses lean during a stunt", () => {
    const state = ramp(0, 11, 1 / 60);
    for (let frame = 0; frame < 120; frame++) stepKartVisualDynamics(state, 11, 1, true, true, 0, 1 / 60);
    expect(Math.abs(state.pitch)).toBeLessThan(.0001);
    expect(Math.abs(state.roll)).toBeLessThan(.0001);
    stepKartVisualDynamics(state, 0, 0, false, false, 0, 1 / 60, true);
    expect(state.pitch).toBe(0);
    expect(state.roll).toBe(0);
    stepKartVisualDynamics(state, 23, 1, false, false, 0, 1);
    expect(state.pitch).toBe(0);
    expect(state.roll).toBe(0);
  });
});

describe("world-scaled wheel motion", () => {
  it("rolls one revolution over one tyre circumference in both directions", () => {
    const wheel = createWheelVisualDynamics(), radius = .29 * .72;
    for (let frame = 0; frame < 60; frame++) stepWheelVisualDynamics(wheel, Math.PI * 2 * radius, 0, radius, 1 / 60);
    expect(Math.sin(wheel.spin)).toBeCloseTo(0, 10);
    expect(Math.cos(wheel.spin)).toBeCloseTo(1, 10);
    const reverse = createWheelVisualDynamics();
    stepWheelVisualDynamics(reverse, -2, 0, radius, 1 / 60);
    expect(reverse.spin).toBeGreaterThan(0);
  });
  it("filters steering packet steps and does not spin through a background frame gap", () => {
    const wheel = createWheelVisualDynamics();
    stepWheelVisualDynamics(wheel, 17, 1, .2, 1 / 60);
    expect(wheel.steering).toBeLessThan(0);
    expect(wheel.steering).toBeGreaterThan(-.1);
    const spin = wheel.spin;
    stepWheelVisualDynamics(wheel, 17, 0, .2, 1);
    expect(wheel.spin).toBe(spin);
    expect(wheel.steering).toBeCloseTo(0, 10);
  });
});


describe("drawn road-normal continuity", () => {
  it("softens a 4.57-degree seam and reaches the actual slope promptly", () => {
    const state = createKartSurfaceDynamics(), seam = 4.57 * Math.PI / 180;
    stepKartSurfaceDynamics(state, 0, 0, 1 / 60);
    stepKartSurfaceDynamics(state, seam, -.03, 1 / 60);
    expect(state.pitch).toBeGreaterThan(0);
    expect(state.pitch).toBeLessThan(seam * .4);
    for (let frame = 0; frame < 12; frame++) stepKartSurfaceDynamics(state, seam, -.03, 1 / 60);
    expect(state.pitch).toBeCloseTo(seam, 2);
    expect(state.roll).toBeCloseTo(-.03, 3);
  });
  it("snaps correctly on landing/teleport and a background frame gap", () => {
    const state = createKartSurfaceDynamics();
    stepKartSurfaceDynamics(state, .3, .1, 1 / 60);
    stepKartSurfaceDynamics(state, 0, 0, 1 / 60, true);
    expect(state.pitch).toBe(0);
    expect(state.roll).toBe(0);
    stepKartSurfaceDynamics(state, -.2, -.05, 1);
    expect(state.pitch).toBe(-.2);
    expect(state.roll).toBe(-.05);
  });
});
