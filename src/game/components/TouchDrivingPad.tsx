import { useCallback, useEffect, useRef } from "react";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import { useControllerInput } from "../input/useControllerInput";
import { InputSender } from "../network/inputSender";
import { TouchControlPad } from "./TouchControlPad";

const ignoreSensorError = () => {};
export function TouchDrivingPad({ sendInput }: { sendInput: (input: KartInput) => void }) {
  const sender = useRef<InputSender | null>(null);
  useEffect(() => {
    const transport = new InputSender(sendInput);
    sender.current = transport;
    return () => {
      transport.dispose();
      sender.current = null;
      sendInput(EMPTY_KART_INPUT);
    };
  }, [sendInput]);
  const transmit = useCallback((input: KartInput) => sender.current?.send(input), []);
  const { preview, updateTouch } = useControllerInput({ sendInput: transmit,
    heartbeatEnabled: true, keyboard: false, autoAccelerate: true, setError: ignoreSensorError });
  return <TouchControlPad input={preview} updateTouch={updateTouch} />;
}
