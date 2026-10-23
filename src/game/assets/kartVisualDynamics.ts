/** Presentation-only suspension. Authority, wheel contact and driving tuning
 * stay outside this module; no periodic vibration is added at cruising speed.
 */
export const KART_VISUAL_CONFIG = {
  speedResponse: 12, accelerationResponse: 7, bodyResponse: 9, surfaceResponse: 20,
  accelerationLimit: 20, pitchPerAcceleration: .004,
  maximumPitch: .08, normalLean: .07, driftLean: .13,
  steeringFullSpeed: 12, impactPitch: .035, impactSink: .025,
  impactDecay: 12, wheelSteerResponse: 13, wheelSteerAngle: .35,
  maximumFrameGap: .2,
} as const;
export function createKartVisualDynamics() {
  return { initialized: false, speed: 0, acceleration: 0, pitch: 0, roll: 0,
    sink: 0, impact: 0, previousImpact: 0 };
}
export function stepKartVisualDynamics(state: ReturnType<typeof createKartVisualDynamics>,
  speed: number, steer: number, drifting: boolean, airborne: boolean,
  impact: number, delta: number, reset = false) {
  const config = KART_VISUAL_CONFIG;
  if (!state.initialized || reset || delta > config.maximumFrameGap) {
    state.initialized = true; state.speed = speed; state.acceleration = 0;
    state.pitch = 0; state.roll = 0; state.sink = 0; state.impact = 0;
    state.previousImpact = impact;
    return;
  }
  const dt = Math.max(0, delta);
  if (dt === 0) return;
  const previousSpeed = state.speed;
  state.speed += (speed - state.speed) * (1 - Math.exp(-config.speedResponse * dt));
  const acceleration = Math.max(-config.accelerationLimit, Math.min(config.accelerationLimit, (state.speed - previousSpeed) / dt));
  state.acceleration += (acceleration - state.acceleration) * (1 - Math.exp(-config.accelerationResponse * dt));
  if (impact > state.previousImpact + .05) state.impact = Math.min(1, impact);
  state.previousImpact = impact;
  state.impact *= Math.exp(-config.impactDecay * dt);
  const weight = Math.min(1, Math.abs(state.speed) / config.steeringFullSpeed);
  const pitch = airborne ? 0 : Math.max(-config.maximumPitch, Math.min(config.maximumPitch,
    state.acceleration * config.pitchPerAcceleration - state.impact * config.impactPitch));
  const roll = airborne ? 0 : -steer * weight * (drifting ? config.driftLean : config.normalLean);
  const response = 1 - Math.exp(-config.bodyResponse * dt);
  state.pitch += (pitch - state.pitch) * response;
  state.roll += (roll - state.roll) * response;
  state.sink = airborne ? 0 : -state.impact * config.impactSink;
}

export function createWheelVisualDynamics() { return { steering: 0, spin: 0 }; }
export function stepWheelVisualDynamics(state: ReturnType<typeof createWheelVisualDynamics>,
  speed: number, steer: number, worldRadius: number, delta: number) {
  const dt = Math.max(0, Math.min(delta, KART_VISUAL_CONFIG.maximumFrameGap));
  if (delta > KART_VISUAL_CONFIG.maximumFrameGap) {
    state.steering = -steer * KART_VISUAL_CONFIG.wheelSteerAngle;
    return;
  }
  state.steering += (-steer * KART_VISUAL_CONFIG.wheelSteerAngle - state.steering) *
    (1 - Math.exp(-KART_VISUAL_CONFIG.wheelSteerResponse * dt));
  state.spin = (state.spin - speed * dt / worldRadius) % (Math.PI * 2);
}

export function createKartSurfaceDynamics() { return { initialized: false, pitch: 0, roll: 0 }; }
/** Filter road-normal seams in the drawn pose; yaw and road height are untouched. */
export function stepKartSurfaceDynamics(state: ReturnType<typeof createKartSurfaceDynamics>,
  pitch: number, roll: number, delta: number, reset = false) {
  if (!state.initialized || reset || delta > KART_VISUAL_CONFIG.maximumFrameGap) {
    state.initialized = true; state.pitch = pitch; state.roll = roll;
    return;
  }
  const response = 1 - Math.exp(-KART_VISUAL_CONFIG.surfaceResponse * Math.max(0, delta));
  state.pitch += Math.atan2(Math.sin(pitch - state.pitch), Math.cos(pitch - state.pitch)) * response;
  state.roll += Math.atan2(Math.sin(roll - state.roll), Math.cos(roll - state.roll)) * response;
}
