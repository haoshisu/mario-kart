import { getCountdownCue } from "../core/race/raceStateMachine";
import type { CountdownCue, RacePhase, RaceState } from "../core/race/raceTypes";

export type RaceCommands = {
  restartRequested: boolean;
  syntheticCrossingsRequested: number;
  forcedRespawnRequested: boolean;
};

export type RaceTelemetry = Readonly<{
  phase: RacePhase;
  countdownCue: CountdownCue;
  currentLap: number;
  completedLaps: number;
  totalLaps: number;
  elapsedTime: number;
  currentLapTime: number;
  lapTimes: readonly number[];
  lastLapTime: number | null;
  bestLapTime: number | null;
  progressPercent: number;
  checkpoint: number;
  checkpointCount: number;
  respawnProtectionRemaining: number;
  respawnCount: number;
}>;

export function createRaceCommands(): RaceCommands {
  return {
    restartRequested: false,
    syntheticCrossingsRequested: 0,
    forcedRespawnRequested: false,
  };
}

export function createRaceTelemetry(state: RaceState, checkpointCount: number): RaceTelemetry {
  const lastLapTime = state.lapTimes.at(-1) ?? null;
  const bestLapTime = state.lapTimes.length > 0 ? Math.min(...state.lapTimes) : null;
  const currentLapTime =
    state.phase === "FINISHED"
      ? lastLapTime ?? 0
      : Math.max(0, state.elapsedTime - state.lapStartTime);

  return {
    phase: state.phase,
    countdownCue: getCountdownCue(state),
    currentLap: Math.min(state.completedLaps + 1, state.totalLaps),
    completedLaps: state.completedLaps,
    totalLaps: state.totalLaps,
    elapsedTime: state.finishTime ?? state.elapsedTime,
    currentLapTime,
    lapTimes: state.lapTimes,
    lastLapTime,
    bestLapTime,
    progressPercent: state.progress.raceFraction * 100,
    checkpoint: state.expectedCheckpointIndex,
    checkpointCount,
    respawnProtectionRemaining: state.respawn.protectionRemaining,
    respawnCount: state.respawn.count,
  };
}
