import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";

export type TouchControl = "throttle" | "brake" | "left" | "right" | "drift";

export class TouchInputController {
  private readonly pointers = new Map<number, TouchControl>();
  private input: KartInput = EMPTY_KART_INPUT;

  press(pointerId: number, control: TouchControl) {
    this.pointers.set(pointerId, control);
    this.updateInput();
  }

  release(pointerId: number) {
    const changed = this.pointers.delete(pointerId);
    if (changed) {
      this.updateInput();
    }
  }

  reset() {
    this.pointers.clear();
    this.input = EMPTY_KART_INPUT;
  }

  read() {
    return this.input;
  }

  isPressed(control: TouchControl) {
    return [...this.pointers.values()].includes(control);
  }

  private updateInput() {
    const controls = new Set(this.pointers.values());
    this.input = {
      throttle: controls.has("throttle") ? 1 : 0,
      brake: controls.has("brake") ? 1 : 0,
      steer: Number(controls.has("right")) - Number(controls.has("left")),
      drift: controls.has("drift"),
    };
  }
}

export function composeControllerInput(
  touchInput: KartInput,
  tiltSteer: number,
  tiltEnabled: boolean,
  autoAccelerate = false,
): KartInput {
  return {
    ...touchInput,
    throttle: touchInput.brake > 0 ? 0 : autoAccelerate ? 1 : touchInput.throttle,
    steer: touchInput.steer !== 0 || !tiltEnabled ? touchInput.steer : tiltSteer,
  };
}

export function resetForBackground(controller: TouchInputController, hidden: boolean) {
  if (!hidden) {
    return false;
  }
  controller.reset();
  return true;
}

