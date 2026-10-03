import type { PointerEvent, ReactNode } from "react";
import type { KartInput } from "../core/kart/kartTypes";
import type { TouchControl } from "../input/touchInput";

export function TouchControlPad({ input, updateTouch }: {
  input: KartInput;
  updateTouch: (pointerId: number, control: TouchControl, pressed: boolean) => void;
}) {
  const pointerDown = (control: TouchControl) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    updateTouch(event.pointerId, control, true);
    if (event.isTrusted) event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerUp = (control: TouchControl) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    updateTouch(event.pointerId, control, false);
  };
  return <section className="controller-pad" aria-label="卡丁車觸控控制">
        <div className="controller-pad__steering" onPointerMove={event => {
          if (event.buttons === 0) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          updateTouch(event.pointerId, event.clientX < bounds.x + bounds.width / 2 ? "left" : "right", true);
        }}>
          <ControlButton control="left" label="左轉" onDown={pointerDown("left")} onUp={pointerUp("left")} pressed={input.steer < 0}><SteeringIcon direction="left" /></ControlButton>
          <ControlButton control="right" label="右轉" onDown={pointerDown("right")} onUp={pointerUp("right")} pressed={input.steer > 0}><SteeringIcon direction="right" /></ControlButton>
        </div>
        <div className="controller-pad__actions">
          <ControlButton control="drift" label="漂移" onDown={pointerDown("drift")} onUp={pointerUp("drift")} pressed={input.drift}><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="26" r="14" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M14 26h20M24 12v28M14 16l20 20M34 16L14 36M8 12h12l-4-6M8 12l5 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg><span>漂移</span></ControlButton>
          <ControlButton control="brake" label="煞車或倒車" onDown={pointerDown("brake")} onUp={pointerUp("brake")} pressed={input.brake > 0}><span aria-hidden="true">Ⅱ</span><small>煞車</small></ControlButton>
        </div>
      </section>;
}

type ControlButtonProps = {
  children: ReactNode;
  control: TouchControl;
  label: string;
  pressed: boolean;
  onDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onUp: (event: PointerEvent<HTMLButtonElement>) => void;
};

function ControlButton({ children, control, label, pressed, onDown, onUp }: ControlButtonProps) {
  return (
    <button
      aria-label={label}
      className={pressed ? "is-pressed" : undefined}
      data-control={control}
      onLostPointerCapture={onUp}
      onPointerCancel={onUp}
      onPointerDown={onDown}
      onPointerUp={onUp}
      type="button"
    >
      {children}
    </button>
  );
}

function SteeringIcon({ direction }: { direction: "left" | "right" }) {
  return <svg viewBox="0 0 40 48" aria-hidden="true" style={{ transform: direction === "right" ? "rotate(180deg)" : undefined }}>
    <path d="M27 8L11 24l16 16-8-16Z" fill="currentColor" />
  </svg>;
}
