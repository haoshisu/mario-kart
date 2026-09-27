import { describe, expect, it } from "vitest";
import { TiltInputController, getTiltAxis } from "./tiltInput";

describe("tilt input", () => {
  it("selects the correct axis in portrait and both landscape orientations", () => {
    const sample = { beta: 20, gamma: -8 };
    expect(getTiltAxis({ ...sample, screenAngle: 0 })).toBe(-8);
    expect(getTiltAxis({ ...sample, screenAngle: 90 })).toBe(20);
    expect(getTiltAxis({ ...sample, screenAngle: 270 })).toBe(-20);
  });

  it("calibrates neutral and clamps steering", () => {
    const controller = new TiltInputController(20);
    expect(controller.update({ beta: 0, gamma: 5, screenAngle: 0 })).toBe(0);
    expect(controller.update({ beta: 0, gamma: 15, screenAngle: 0 })).toBeCloseTo(0.5);
    expect(controller.update({ beta: 0, gamma: 50, screenAngle: 0 })).toBe(1);
    expect(controller.update({ beta: 0, gamma: -50, screenAngle: 0 })).toBe(-1);
  });

  it("recalibrates after an orientation change", () => {
    const controller = new TiltInputController();
    controller.update({ beta: 0, gamma: 10, screenAngle: 0 });
    expect(controller.update({ beta: 15, gamma: 10, screenAngle: 90 })).toBe(0);
  });
});

