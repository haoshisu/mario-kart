import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";

export type KeyboardEventLike = Readonly<{
  code: string;
  preventDefault?: () => void;
}>;

const CONTROL_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export class KeyboardInputController {
  private readonly pressed = new Set<string>();
  private input: KartInput = EMPTY_KART_INPUT;

  keyDown(event: KeyboardEventLike) {
    if (!CONTROL_CODES.has(event.code)) {
      return false;
    }
    event.preventDefault?.();
    this.pressed.add(event.code);
    this.updateInput();
    return true;
  }

  keyUp(event: KeyboardEventLike) {
    if (!CONTROL_CODES.has(event.code)) {
      return false;
    }
    event.preventDefault?.();
    this.pressed.delete(event.code);
    this.updateInput();
    return true;
  }

  reset() {
    this.pressed.clear();
    this.input = EMPTY_KART_INPUT;
  }

  read(): KartInput {
    return this.input;
  }

  private updateInput() {
    const left = this.pressed.has("KeyA") || this.pressed.has("ArrowLeft");
    const right = this.pressed.has("KeyD") || this.pressed.has("ArrowRight");

    this.input = {
      throttle: this.pressed.has("KeyW") || this.pressed.has("ArrowUp") ? 1 : 0,
      brake: this.pressed.has("KeyS") || this.pressed.has("ArrowDown") ? 1 : 0,
      steer: Number(right) - Number(left),
      drift: this.pressed.has("Space"),
    };
  }
}
