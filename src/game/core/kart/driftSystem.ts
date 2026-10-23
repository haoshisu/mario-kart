import { KART_CONFIG, type DriftTier } from "./kartConfig";
import type { DriftState, KartInput } from "./kartTypes";

export type DriftUpdate = Readonly<{
  state: DriftState;
  turboTriggered: boolean;
  turboTierTriggered: DriftTier;
}>;

export function createInitialDriftState(): DriftState {
  return {
    active: false,
    direction: 0,
    charge: 0,
    chargeTier: 0,
    turboRemaining: 0,
    turboTier: 0,
  };
}

export function getDriftChargeTier(charge: number): DriftTier {
  let tier: DriftTier = 0;
  for (const config of KART_CONFIG.driftTiers) {
    if (charge >= config.chargeTime) {
      tier = config.tier;
    }
  }
  return tier;
}

export function clearDriftBoost(current: DriftState): DriftState {
  return {
    ...current,
    turboRemaining: 0,
    turboTier: 0,
  };
}

export function updateDriftState(
  current: DriftState,
  input: KartInput,
  absoluteSpeed: number,
  deltaTime: number,
): DriftUpdate {
  const dt = Math.max(0, Math.min(deltaTime, 0.05));
  const canStart =
    absoluteSpeed >= KART_CONFIG.driftMinimumSpeed &&
    Math.abs(input.steer) >= KART_CONFIG.driftMinimumSteer;
  const staysActive = current.active && absoluteSpeed >= KART_CONFIG.driftMinimumSpeed;
  const active = input.drift && input.brake === 0 && (canStart || staysActive);
  const direction = active ? (current.active ? current.direction : input.steer < 0 ? -1 : 1) : 0;
  const released = current.active && !input.drift && input.brake === 0 && absoluteSpeed >= KART_CONFIG.driftMinimumSpeed;
  const validTurn = direction * input.steer >= KART_CONFIG.driftMinimumSteer;
  const chargeRate = KART_CONFIG.driftArc.minimumChargeRate + (1 - KART_CONFIG.driftArc.minimumChargeRate) * Math.min(1, Math.abs(input.steer));
  const charge = active ? current.charge + (validTurn ? dt * chargeRate : 0) : 0;
  const chargeTier = active ? getDriftChargeTier(charge) : 0;
  const turboTierTriggered = released ? current.chargeTier : 0;
  const turboTriggered = turboTierTriggered > 0;
  const triggeredConfig = turboTriggered
    ? KART_CONFIG.driftTiers[turboTierTriggered - 1]
    : null;
  const turboRemaining = triggeredConfig
    ? triggeredConfig.duration
    : Math.max(0, current.turboRemaining - dt);
  const turboTier = triggeredConfig
    ? turboTierTriggered
    : turboRemaining > 0
      ? current.turboTier
      : 0;

  return {
    state: {
      active,
      direction,
      charge,
      chargeTier,
      turboRemaining,
      turboTier,
    },
    turboTriggered,
    turboTierTriggered,
  };
}

/** Countersteer opens the arc without flipping the established drift side. */
export function getDriftSteering(drift: DriftState, steer: number) {
  if (!drift.active) return Math.max(-1, Math.min(1, steer));
  const aligned = Math.max(-1, Math.min(1, steer * drift.direction));
  const arc = KART_CONFIG.driftArc;
  return drift.direction * (arc.neutral + aligned * (aligned < 0 ? arc.neutral - arc.outer : arc.inner - arc.neutral));
}
