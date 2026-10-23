import { KART_CONFIG } from "../core/kart/kartConfig";

const FLOW = { onset: 10, cruisingOpacity: .16, boostOpacity: .3, slowPeriod: .8, fastPeriod: .32 } as const;
const RAYS = Array.from({ length: 16 }, (_, index) => {
  const angle = index * Math.PI / 8;
  return { x: 500 + Math.cos(angle) * 900, y: 580 + Math.sin(angle) * 900 };
});

/** Peripheral optic flow follows actual speed; the road and controls stay clear. */
export function SpeedFlow({ speed, boosting, active }: { speed: number; boosting: boolean; active: boolean }) {
  const weight = active ? Math.min(1, Math.max(0, (speed - FLOW.onset) / (KART_CONFIG.maxForwardSpeed - FLOW.onset))) : 0;
  const opacity = weight * (boosting ? FLOW.boostOpacity : FLOW.cruisingOpacity);
  return <svg className="speed-flow" viewBox="0 0 1000 1000" preserveAspectRatio="none"
    data-testid="speed-flow" data-speed={speed} data-active={opacity > 0} aria-hidden="true"
    style={{ opacity, animationDuration: `${FLOW.slowPeriod + (FLOW.fastPeriod - FLOW.slowPeriod) * weight}s` }}>
    {RAYS.map((ray, index) => <line key={index} x1="500" y1="580" x2={ray.x} y2={ray.y} />)}
  </svg>;
}
