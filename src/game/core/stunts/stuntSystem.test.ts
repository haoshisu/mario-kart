import { describe, expect, it } from "vitest";
import { applyRampSurface, createStuntState, finishStunt, stepStuntLaunch, STUNT_CONFIG, stuntProgress } from "./stuntSystem";
import { createSurfaceResult } from "../../track/trackSurface";

const ramp = { id: "test", position: [0, 0] as const, height: 0, yaw: -Math.PI / 2,
  pitch: 0, roll: 0, forward: [1, 0] as const };
function cross(speed = 12, z = 0, yaw = ramp.yaw, y = 1.32, enabled = true) {
  const state = createStuntState();
  stepStuntLaunch(state, -.2, y, z, yaw, speed, [ramp], enabled, 1 / 60);
  const launched = stepStuntLaunch(state, .1, y, z, yaw, speed, [ramp], enabled, 1 / 60);
  return { state, launched };
}
describe("stunt ramps", () => {
  it("adds an actual inclined driving surface and leaves adjacent lanes clear", () => {
    const road = () => ({ ...createSurfaceResult(), height: 2, distance: 0 });
    expect(applyRampSurface(-2, 0, [ramp], road())).toMatchObject({ height: 2.4, gradientX: .2 });
    expect(applyRampSurface(-2, 2, [ramp], road())).toMatchObject({ height: 2, gradientX: 0 });
    expect(applyRampSurface(1, 0, [ramp], road()).height).toBe(2);
  });
  it("launches once when crossing the lip forward at driving speed", () => {
    const { state, launched } = cross();
    expect(launched).toBe(true);
    expect(stepStuntLaunch(state, .3, 2, 0, ramp.yaw, 12, [ramp], true, .05)).toBe(false);
    expect(stuntProgress(state)).toBeGreaterThan(0);
  });
  it("rejects slow, sideways, reverse, airborne, off-lane and disabled crossings", () => {
    expect(cross(3).launched).toBe(false);
    expect(cross(12, 2).launched).toBe(false);
    expect(cross(12, 0, 0).launched).toBe(false);
    expect(cross(-12).launched).toBe(false);
    expect(cross(12, 0, ramp.yaw, 5).launched).toBe(false);
    expect(cross(12, 0, ramp.yaw, 1.32, false).launched).toBe(false);
  });
  it("rewards only a descending landing on the road and imposes cooldown", () => {
    const { state } = cross(); state.elapsed = 1;
    expect(finishStunt(state, .1, 2, 0)).toBe(false);
    expect(finishStunt(state, .1, -2, 6)).toBe(false);
    expect(finishStunt(state, 1, -2, 0)).toBe(false);
    expect(finishStunt(state, .1, -2, 0)).toBe(true);
    expect(state.cooldown).toBe(STUNT_CONFIG.cooldown);
    expect(stuntProgress(state)).toBe(0);
    expect(finishStunt(state, 0, 0, 0)).toBe(false);
  });
  it("ends a failed jump without granting a landing reward", () => {
    const { state } = cross(); state.elapsed = 5;
    expect(finishStunt(state, 5, -2, 10)).toBe(false);
    expect(state.active).toBe(false);
  });
});
