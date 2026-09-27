import { describe, expect, it } from "vitest";
import { createCameraMotion, stepCameraMotion } from "./cameraMotion";

const origin = { x: 0, y: 0.512, z: 0 };

describe("camera motion", () => {
  it("keeps the horizontal follow distance fixed through acceleration and braking", () => {
    const motion = createCameraMotion();
    for (const x of [0, 0.1, 0.4, 0.9, 1.7, 2.6, 3.1, 3.2, 3.2, 3.1]) {
      stepCameraMotion(motion, { ...origin, x }, 0, 1 / 60, 0);
      expect(motion.x.value - x).toBe(0);
      expect(motion.z.value).toBe(origin.z);
    }
  });

  it("eases steering changes without overshoot and wraps headings by the short path", () => {
    const motion = createCameraMotion();
    stepCameraMotion(motion, origin, Math.PI - 0.02, 1 / 60, 0);
    const before = motion.yaw.value;
    stepCameraMotion(motion, origin, -Math.PI + 0.02, 1 / 60, 0);
    expect(motion.yaw.value - before).toBeGreaterThan(0);
    expect(motion.yaw.value - before).toBeLessThan(0.01);
    for (let i = 0; i < 120; i++) stepCameraMotion(motion, origin, -Math.PI + 0.02, 1 / 60, 0);
    expect(motion.yaw.value).toBeCloseTo(Math.PI + 0.02, 5);
  });

  it("settles consistently at different refresh rates", () => {
    const results = [30, 60, 120, 144].map((fps) => {
      const motion = createCameraMotion();
      stepCameraMotion(motion, origin, 0, 1 / fps, 0);
      for (let i = 0; i < fps; i++) stepCameraMotion(motion, { ...origin, x: 5 }, 1, 1 / fps, 0);
      return motion;
    });
    for (const result of results) {
      expect(result.x.value).toBeCloseTo(results[0].x.value, 8);
      expect(result.yaw.value).toBeCloseTo(results[0].yaw.value, 8);
    }
  });

  it("resets camera momentum after a respawn or suspended frame", () => {
    const motion = createCameraMotion();
    stepCameraMotion(motion, origin, 0, 1 / 60, 0);
    stepCameraMotion(motion, { ...origin, x: 5 }, 1, 1 / 60, 0);
    stepCameraMotion(motion, { ...origin, x: -20 }, 0, 1 / 60, 1);
    expect(motion.x.value).toBe(-20);
    expect(motion.x.velocity).toBe(0);
    stepCameraMotion(motion, { ...origin, x: 10 }, 0, 2, 1);
    expect(motion.x.value).toBe(10);
    expect(motion.x.velocity).toBe(0);
  });
});
