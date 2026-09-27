import type { RaceMarker, RespawnPose } from "./raceTrack";

export type RacePhase = "IDLE" | "COUNTDOWN" | "RACING" | "FINISHED";
export type CountdownCue = "3" | "2" | "1" | "GO" | null;
export type RespawnReason = "out-of-bounds" | "flipped" | "stuck";

export type RaceProgress = Readonly<{
  rawTrackFraction: number;
  validLapFraction: number;
  raceFraction: number;
  distanceFromTrack: number;
  rankingScore: number;
}>;

export type RaceState = Readonly<{
  phase: RacePhase;
  countdownRemaining: number;
  goDisplayRemaining: number;
  elapsedTime: number;
  finishTime: number | null;
  totalLaps: number;
  completedLaps: number;
  lapStartTime: number;
  lapTimes: readonly number[];
  expectedCheckpointIndex: number;
  lastValidMarkerId: RaceMarker["id"];
  previousPosition: readonly [x: number, z: number] | null;
  progress: RaceProgress;
  respawn: Readonly<{
    stuckDuration: number;
    protectionRemaining: number;
    count: number;
  }>;
}>;

export type RaceEvent =
  | Readonly<{ type: "COUNTDOWN_STARTED" }>
  | Readonly<{ type: "RACE_STARTED" }>
  | Readonly<{ type: "CHECKPOINT_PASSED"; checkpointId: RaceMarker["id"] }>
  | Readonly<{ type: "LAP_COMPLETED"; lap: number; lapTime: number }>
  | Readonly<{ type: "RACE_FINISHED"; finishTime: number }>
  | Readonly<{ type: "RESPAWN"; reason: RespawnReason; pose: RespawnPose }>;

export type RaceStepInput = Readonly<{
  position: readonly [x: number, y: number, z: number];
  signedSpeed: number;
  throttle: number;
  upY: number;
}>;

export type RaceStepResult = Readonly<{
  state: RaceState;
  events: readonly RaceEvent[];
  respawn: Readonly<{ reason: RespawnReason; pose: RespawnPose }> | null;
}>;
