import { describe, expect, it } from "vitest";
import { KeyboardInputController, type KeyboardEventLike } from "./keyboard";

function key(code: string) {
  let prevented = false;
  const event: KeyboardEventLike = {
    code,
    preventDefault: () => {
      prevented = true;
    },
  };
  return { event, wasPrevented: () => prevented };
}

describe("KeyboardInputController", () => {
  it("maps WASD, arrows, and Space to normalized kart input", () => {
    const controller = new KeyboardInputController();
    const throttle = key("KeyW");
    const left = key("ArrowLeft");
    const drift = key("Space");

    controller.keyDown(throttle.event);
    controller.keyDown(left.event);
    controller.keyDown(drift.event);

    expect(controller.read()).toEqual({
      throttle: 1,
      brake: 0,
      steer: -1,
      drift: true,
    });
    expect(throttle.wasPrevented()).toBe(true);
    expect(left.wasPrevented()).toBe(true);
    expect(drift.wasPrevented()).toBe(true);
  });

  it("restores each control when its key is released", () => {
    const controller = new KeyboardInputController();
    controller.keyDown(key("ArrowUp").event);
    controller.keyDown(key("KeyD").event);
    controller.keyUp(key("ArrowUp").event);

    expect(controller.read()).toEqual({
      throttle: 0,
      brake: 0,
      steer: 1,
      drift: false,
    });

    controller.keyUp(key("KeyD").event);
    expect(controller.read().steer).toBe(0);
  });

  it("cancels opposing steering inputs and clears all input on reset", () => {
    const controller = new KeyboardInputController();
    controller.keyDown(key("KeyA").event);
    controller.keyDown(key("ArrowRight").event);
    controller.keyDown(key("ArrowDown").event);

    expect(controller.read().steer).toBe(0);
    expect(controller.read().brake).toBe(1);

    controller.reset();
    expect(controller.read()).toEqual({
      throttle: 0,
      brake: 0,
      steer: 0,
      drift: false,
    });
  });

  it("ignores unrelated keys", () => {
    const controller = new KeyboardInputController();
    const unrelated = key("KeyQ");

    expect(controller.keyDown(unrelated.event)).toBe(false);
    expect(unrelated.wasPrevented()).toBe(false);
  });
});
