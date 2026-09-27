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
  const active = input.drift && (canStart || staysActive);
  const released = current.active && !input.drift;
  const charge = active ? current.charge + dt : 0;
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
      charge,
      chargeTier,
      turboRemaining,
      turboTier,
    },
    turboTriggered,
    turboTierTriggered,
  };
}
