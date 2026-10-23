import { TRACK_LAYOUT } from "../../track/trackLayout";

export const KART_CONFIG = {
  modelScale: 0.72,
  launch: { speed: 10, duration: 1.1 },
  fixedTimeStep: 1 / 60,
  // Predict contacts without hard CCD clipping travel at coplanar road seams.
  // At 60 Hz this covers a full step even at the fastest turbo tier.
  softCcdPrediction: 0.5,
  wheels: { radius: 0.29, centerY: -0.14, halfTrack: 0.72, frontZ: -0.55, rearZ: 0.62 },
  // Road adhesion owns the wheel height. Keep the solid body above curved
  // grade seams so their contacts cannot brake an otherwise grounded kart.
  grounding: { probeLift: 0.1, probeHalfLength: 1.02, snapDistance: 0.2, clearance: 0.002, colliderLift: 0.12 },
  acceleration: 11.5,
  reverseAcceleration: 7,
  brakeDeceleration: 18,
  coastDeceleration: 3.8,
  maxForwardSpeed: 17,
  maxReverseSpeed: 5.5,
  steeringRate: 1.95,
  steeringFullSpeed: 9,
  minimumSteeringSpeed: 0.35,
  normalLateralGrip: 24,
  driftLateralGrip: 5,
  driftSlipAngle: 0.42,
  visual: { normalLean: 0.025, driftLean: 0.09 },
  presentation: { positionFrequency: 28, maximumFrameGap: 0.25 },
  driftMinimumSpeed: 5,
  driftMinimumSteer: 0.18,
  driftSteeringMultiplier: 1.3,
  driftArc: { outer: 0.06, neutral: 0.18, inner: 0.65, minimumChargeRate: 0.55 },
  turboReleaseDrag: 4,
  driftTiers: [
    {
      tier: 1,
      chargeTime: 0.55,
      duration: 0.8,
      acceleration: 9.5,
      maxSpeed: 19.5,
      color: "#46dcff",
      label: "MINI TURBO",
    },
    {
      tier: 2,
      chargeTime: 1.2,
      duration: 1.15,
      acceleration: 11.5,
      maxSpeed: 21.5,
      color: "#b58cff",
      label: "SUPER TURBO",
    },
    {
      tier: 3,
      chargeTime: 2,
      duration: 1.55,
      acceleration: 13.5,
      maxSpeed: 23,
      color: "#d7ff38",
      label: "ULTRA TURBO",
    },
  ],
  telemetryIntervalSteps: 6,
  collision: {
    minimumImpactSpeed: 2.2,
    heavyImpactSpeed: 8,
    speedRetention: 0.78,
    rebound: 0.48,
    reboundSeconds: 0.3,
    cooldown: 0.2,
  },
  camera: {
    distance: 6.8,
    height: 4.4,
    lookAhead: 2.4,
    heightFrequency: 20,
    turnFrequency: 18,
    maximumFrameGap: 0.25,
    minimumHeight: 2.6,
  },
} as const;

export type DriftTier = 0 | 1 | 2 | 3;

export function getDriftTierConfig(tier: DriftTier) {
  return tier === 0 ? null : KART_CONFIG.driftTiers[tier - 1];
}

export const KART_START = {
  position: [
    TRACK_LAYOUT.spawn[0],
    0.52,
    TRACK_LAYOUT.spawn[1],
  ] as const,
  yaw: TRACK_LAYOUT.spawnYaw,
} as const;

export const KART_WHEEL_POSITIONS: [number, number, number][] = [
  [-KART_CONFIG.wheels.halfTrack, KART_CONFIG.wheels.centerY, KART_CONFIG.wheels.frontZ],
  [KART_CONFIG.wheels.halfTrack, KART_CONFIG.wheels.centerY, KART_CONFIG.wheels.frontZ],
  [-KART_CONFIG.wheels.halfTrack, KART_CONFIG.wheels.centerY, KART_CONFIG.wheels.rearZ],
  [KART_CONFIG.wheels.halfTrack, KART_CONFIG.wheels.centerY, KART_CONFIG.wheels.rearZ],
];
