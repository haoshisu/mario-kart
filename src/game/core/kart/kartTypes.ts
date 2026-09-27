import type { DriftTier } from "./kartConfig";

export type KartInput = Readonly<{
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
}>;

export type DriftState = Readonly<{
  active: boolean;
  charge: number;
  chargeTier: DriftTier;
  turboRemaining: number;
  turboTier: DriftTier;
}>;

export type KartSimulationState = Readonly<{
  speed: number;
  yaw: number;
  drift: DriftState;
}>;

export type KartStepResult = Readonly<{
  state: KartSimulationState;
  turboTriggered: boolean;
  turboTierTriggered: DriftTier;
}>;

export const EMPTY_KART_INPUT: KartInput = {
  throttle: 0,
  brake: 0,
  steer: 0,
  drift: false,
};
