import { Vector3 } from "three";
import { KART_START, type DriftTier } from "../core/kart/kartConfig";
import { CHECKPOINTS } from "../core/race/raceTrack";
import { createInitialRaceState } from "../core/race/raceStateMachine";
import { createRaceTelemetry, type RaceTelemetry } from "./raceRuntime";

export type KartRuntimeState = {
  position: { x: number; y: number; z: number };
  renderPosition: Vector3;
  renderYaw: number;
  poseRevision: number;
  yaw: number;
  speed: number;
  steer: number;
  drifting: boolean;
  driftCharge: number;
  driftTier: DriftTier;
  turboRemaining: number;
  turboTier: DriftTier;
  collisionShake: number;
  finished: boolean;
};

export type KartTelemetry = Readonly<{
  signedSpeed: number;
  speedKph: number;
  height: number;
  position: readonly [x: number, z: number];
  yaw: number;
  drifting: boolean;
  driftReady: boolean;
  driftTier: DriftTier;
  turboActive: boolean;
  turboTier: DriftTier;
  impact: "none" | "light" | "heavy";
  race: RaceTelemetry;
}>;

export function createKartRuntimeState(): KartRuntimeState {
  return {
    position: {
      x: KART_START.position[0],
      y: KART_START.position[1],
      z: KART_START.position[2],
    },
    renderPosition: new Vector3(...KART_START.position),
    renderYaw: KART_START.yaw,
    poseRevision: 0,
    yaw: KART_START.yaw,
    speed: 0,
    steer: 0,
    drifting: false,
    driftCharge: 0,
    driftTier: 0,
    turboRemaining: 0,
    turboTier: 0,
    collisionShake: 0,
    finished: false,
  };
}

export const INITIAL_KART_TELEMETRY: KartTelemetry = {
  signedSpeed: 0,
  speedKph: 0,
  height: KART_START.position[1],
  position: [KART_START.position[0], KART_START.position[2]],
  yaw: KART_START.yaw,
  drifting: false,
  driftReady: false,
  driftTier: 0,
  turboActive: false,
  turboTier: 0,
  impact: "none",
  race: createRaceTelemetry(createInitialRaceState(), CHECKPOINTS.length),
};
