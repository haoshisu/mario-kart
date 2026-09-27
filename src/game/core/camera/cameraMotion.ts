import { KART_CONFIG } from "../kart/kartConfig";

import { advanceSpring } from "../motion/dampedSpring";
type Position = Readonly<{ x: number; y: number; z: number }>;

export function createCameraMotion() {
  return {
    x: { value: 0, velocity: 0 },
    y: { value: 0, velocity: 0 },
    z: { value: 0, velocity: 0 },
    yaw: { value: 0, velocity: 0 },
    initialized: false,
    revision: -1,
  };
}

export function stepCameraMotion(
  motion: ReturnType<typeof createCameraMotion>,
  position: Position,
  yaw: number,
  delta: number,
  revision: number,
) {
  const config = KART_CONFIG.camera;
  const reset = !motion.initialized || motion.revision !== revision || delta > config.maximumFrameGap;
  const dt = Math.max(0, Math.min(delta, config.maximumFrameGap));
  // Unwrap the target around the current heading to avoid full spins at ±π.
  const targetYaw = motion.yaw.value + Math.atan2(Math.sin(yaw - motion.yaw.value), Math.cos(yaw - motion.yaw.value));
  // The kart already owns horizontal presentation smoothing. Following that
  // exact pose keeps the camera-to-kart distance independent of speed changes.
  motion.x.value = position.x;
  motion.x.velocity = 0;
  advanceSpring(motion.y, position.y, config.heightFrequency, dt, reset);
  motion.z.value = position.z;
  motion.z.velocity = 0;
  advanceSpring(motion.yaw, targetYaw, config.turnFrequency, dt, reset);
  motion.initialized = true;
  motion.revision = revision;
}
