import { useEffect, useRef } from "react";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import { KeyboardInputController } from "./keyboard";

export function useKeyboardInput(enabled: boolean) {
  const inputRef = useRef<KartInput>(EMPTY_KART_INPUT);

  useEffect(() => {
    const controller = new KeyboardInputController();

    if (!enabled) {
      inputRef.current = EMPTY_KART_INPUT;
      return;
    }

    const sync = () => {
      inputRef.current = controller.read();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (controller.keyDown(event)) {
        sync();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (controller.keyUp(event)) {
        sync();
      }
    };
    const reset = () => {
      controller.reset();
      sync();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reset();
    };
  }, [enabled]);

  return inputRef;
}
