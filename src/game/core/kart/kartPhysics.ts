import { updateDriftState, createInitialDriftState } from "./driftSystem";
import { getDriftTierConfig, KART_CONFIG } from "./kartConfig";
import type { KartInput, KartSimulationState, KartStepResult } from "./kartTypes";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function moveToward(value: number, target: number, amount: number) {
  if (value < target) {
    return Math.min(value + amount, target);
  }
  return Math.max(value - amount, target);
}

function normalizeInput(input: KartInput): KartInput {
  return {
    throttle: clamp(input.throttle, 0, 1),
    brake: clamp(input.brake, 0, 1),
    steer: clamp(input.steer, -1, 1),
    drift: input.drift,
  };
}

export function createInitialKartState(yaw = 0): KartSimulationState {
  return {
    speed: 0,
    yaw,
    drift: createInitialDriftState(),
  };
}

export function getKartForward(yaw: number) {
  return {
    x: -Math.sin(yaw),
    z: -Math.cos(yaw),
  };
}

export function stepKartSimulation(
  current: KartSimulationState,
  rawInput: KartInput,
  deltaTime: number,
  externalBoost?: Readonly<{ acceleration: number; maximumSpeed: number }>,
): KartStepResult {
  const dt = Math.max(0, Math.min(deltaTime, 0.05));
  const input = normalizeInput(rawInput);
  const driftUpdate = updateDriftState(current.drift, input, Math.abs(current.speed), dt);
  let speed = current.speed;

  if (input.brake > 0) {
    if (speed > 0) {
      speed = moveToward(speed, 0, KART_CONFIG.brakeDeceleration * input.brake * dt);
    } else {
      speed -= KART_CONFIG.reverseAcceleration * input.brake * dt;
    }
  } else if (input.throttle > 0) {
    if (speed < 0) {
      speed = moveToward(speed, 0, KART_CONFIG.brakeDeceleration * input.throttle * dt);
    } else {
      speed += KART_CONFIG.acceleration * input.throttle * dt;
    }
  } else {
    speed = moveToward(speed, 0, KART_CONFIG.coastDeceleration * dt);
  }

  const turboConfig = getDriftTierConfig(driftUpdate.state.turboTier);
  if (driftUpdate.state.turboRemaining > 0 && turboConfig) {
    speed += turboConfig.acceleration * dt;
  }
  if (externalBoost) speed += externalBoost.acceleration * dt;

  const maximumSpeed =
    driftUpdate.state.turboRemaining > 0 && turboConfig
      ? turboConfig.maxSpeed
      : KART_CONFIG.maxForwardSpeed;
  speed = clamp(speed, -KART_CONFIG.maxReverseSpeed, Math.max(maximumSpeed, externalBoost?.maximumSpeed ?? 0));

  const speedRatio = clamp(Math.abs(speed) / KART_CONFIG.steeringFullSpeed, 0, 1);
  const canSteer = Math.abs(speed) >= KART_CONFIG.minimumSteeringSpeed;
  const direction = speed >= 0 ? 1 : -1;
  const driftMultiplier = driftUpdate.state.active ? KART_CONFIG.driftSteeringMultiplier : 1;
  const yawDelta = canSteer
    ? -input.steer * KART_CONFIG.steeringRate * speedRatio * direction * driftMultiplier * dt
    : 0;

  return {
    state: {
      speed,
      yaw: current.yaw + yawDelta,
      drift: driftUpdate.state,
    },
    turboTriggered: driftUpdate.turboTriggered,
    turboTierTriggered: driftUpdate.turboTierTriggered,
  };
}

/** A bounded slip angle makes drift visible without accumulating sideways speed. */
export function getKartLateralSpeed(
  current: number, speed: number, steer: number, drifting: boolean, deltaTime: number,
) {
  const dt = clamp(deltaTime, 0, 0.05);
  const target = drifting ? -clamp(steer, -1, 1) * Math.abs(speed) * Math.tan(KART_CONFIG.driftSlipAngle) : 0;
  const grip = drifting ? KART_CONFIG.driftLateralGrip : KART_CONFIG.normalLateralGrip;
  return target + (current - target) * Math.exp(-grip * dt);
}

/** Called only at the authoritative countdown-to-racing transition. */
export function applyLaunchBoost(state: KartSimulationState): KartSimulationState {
  return { ...state, speed: KART_CONFIG.launch.speed,
    drift: { ...createInitialDriftState(), turboTier: 2, turboRemaining: KART_CONFIG.launch.duration } };
}
