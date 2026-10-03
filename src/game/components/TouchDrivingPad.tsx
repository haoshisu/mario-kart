import { useEffect, useRef, useState, type PointerEvent } from "react";
import { TouchInputController, type TouchControl } from "../input/touchInput";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import { InputSender } from "../network/inputSender";
import { NETWORK_CONFIG } from "../network/networkConfig";

const controls: readonly [TouchControl, string, string][] = [
  ["left", "左轉", "←"], ["right", "右轉", "→"],
  ["drift", "漂移", "DRIFT"], ["brake", "煞車或倒車", "BRAKE"], ["throttle", "加速", "GAS"],
];

export function TouchDrivingPad({ sendInput }: { sendInput: (input: KartInput) => void }) {
  const controller = useRef(new TouchInputController());
  const sender = useRef<InputSender | null>(null);
  const [pressed, setPressed] = useState<KartInput>(EMPTY_KART_INPUT);
  useEffect(() => {
    const input = controller.current;
    const transport = new InputSender(sendInput);
    sender.current = transport;
    const reset = () => { input.reset(); setPressed(input.read()); transport.send(input.read()); };
    const visibility = () => { if (document.hidden) reset(); };
    const timer = window.setInterval(() => transport.send(input.read()), 1000 / NETWORK_CONFIG.inputRateHz);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      transport.dispose();
      input.reset();
      sendInput(input.read());
      sender.current = null;
    };
  }, [sendInput]);
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    controller.current.release(event.pointerId);
    const input = controller.current.read();
    setPressed(input);
    sender.current?.send(input);
  };
  return <section className="controller-pad" aria-label="卡丁車觸控控制">
    {[controls.slice(0, 2), controls.slice(2)].map((group, index) => <div key={index} className={index === 0 ? "controller-pad__steering" : "controller-pad__actions"}>
      {group.map(([control, label, text]) => <button key={control} type="button" aria-label={label}
        className={(control === "left" ? pressed.steer < 0 : control === "right" ? pressed.steer > 0 : pressed[control]) ? "is-pressed" : undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          controller.current.press(event.pointerId, control);
          event.currentTarget.setPointerCapture(event.pointerId);
          const input = controller.current.read();
          setPressed(input);
          sender.current?.send(input);
        }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{text}</button>)}
    </div>)}
  </section>;
}
