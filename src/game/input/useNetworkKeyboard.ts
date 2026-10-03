import { useEffect, useRef } from "react";
import type { KartInput } from "../core/kart/kartTypes";
import { InputSender } from "../network/inputSender";
import { NETWORK_CONFIG } from "../network/networkConfig";
import { KeyboardInputController } from "./keyboard";

export function useNetworkKeyboard(enabled: boolean, send: (input: KartInput) => void, useItem: () => void) {
  const itemAction = useRef(useItem);
  useEffect(() => { itemAction.current = useItem; }, [useItem]);
  useEffect(() => {
    if (!enabled) return;
    const keys = new KeyboardInputController();
    const sender = new InputSender(send);
    const flush = () => sender.send(keys.read());
    const reset = () => { keys.reset(); flush(); };
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.code === "KeyE" && !event.repeat) { event.preventDefault(); itemAction.current(); }
      if (keys.keyDown(event)) flush();
    };
    const up = (event: KeyboardEvent) => { if (keys.keyUp(event)) flush(); };
    const visibility = () => { if (document.hidden) reset(); };
    const timer = window.setInterval(flush, 1000 / NETWORK_CONFIG.inputRateHz);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      sender.dispose();
      keys.reset();
      send(keys.read());
    };
  }, [enabled, send]);
}
