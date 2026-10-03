import { describe, expect, it } from "vitest";
import { TouchInputController, composeControllerInput, resetForBackground } from "./touchInput";

describe("TouchInputController", () => {
  it("combines multi-touch acceleration, steering, and drift", () => {
    const controller = new TouchInputController();
    controller.press(1, "throttle");
    controller.press(2, "left");
    controller.press(3, "drift");

    expect(controller.read()).toEqual({
      throttle: 1,
      brake: 0,
      steer: -1,
      drift: true,
    });

    controller.release(2);
    expect(controller.read().steer).toBe(0);
  });

  it("neutralizes opposing steering and resets every held control in background", () => {
    const controller = new TouchInputController();
    controller.press(1, "left");
    controller.press(2, "right");
    controller.press(3, "brake");
    expect(controller.read().steer).toBe(0);

    expect(resetForBackground(controller, true)).toBe(true);
    expect(controller.read()).toEqual({ throttle: 0, brake: 0, steer: 0, drift: false });
  });

  it("uses tilt as a fallback while touch steering has priority", () => {
    expect(
      composeControllerInput({ throttle: 1, brake: 0, steer: 0, drift: false }, 0.6, true),
    ).toEqual({ throttle: 1, brake: 0, steer: 0.6, drift: false });
    expect(
      composeControllerInput({ throttle: 1, brake: 0, steer: -1, drift: false }, 0.6, true),
    ).toEqual({ throttle: 1, brake: 0, steer: -1, drift: false });
  });
  it("auto-accelerates without pedals and lets braking override it", () => {
    const controller = new TouchInputController();
    expect(composeControllerInput(controller.read(), 0, false, true).throttle).toBe(1);
    controller.press(1, "left"); controller.press(2, "drift");
    expect(composeControllerInput(controller.read(), 0, false, true)).toEqual({ throttle: 1, brake: 0, steer: -1, drift: true });
    controller.press(3, "brake");
    expect(composeControllerInput(controller.read(), 0, false, true)).toMatchObject({ throttle: 0, brake: 1 });
    controller.release(3);
    expect(composeControllerInput(controller.read(), 0, false, true).throttle).toBe(1);
  });

});

