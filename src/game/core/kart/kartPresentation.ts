import { KART_CONFIG } from "./kartConfig";
import { advanceSpring } from "../motion/dampedSpring";

export function createKartPresentation() {
  return {
    x: { value: 0, velocity: 0 },
    z: { value: 0, velocity: 0 },
    initialized: false,
    revision: -1,
  };
}

/** Smooth only the displayed horizontal pose, never the authoritative physics. */
export function stepKartPresentation(
  motion: ReturnType<typeof createKartPresentation>,
  position: Readonly<{ x: number; z: number }>,
  delta: number,
  revision: number,
) {
  const config = KART_CONFIG.presentation;
  const reset = !motion.initialized || motion.revision !== revision || delta > config.maximumFrameGap;
  const dt = Math.max(0, Math.min(delta, config.maximumFrameGap));
  advanceSpring(motion.x, position.x, config.positionFrequency, dt, reset);
  advanceSpring(motion.z, position.z, config.positionFrequency, dt, reset);
  motion.initialized = true;
  motion.revision = revision;
}
