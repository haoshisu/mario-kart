import { RACE_CONFIG } from "./raceConfig";
import type { RaceState } from "./raceTypes";

export type RaceTransitionEvent = "START" | "COUNTDOWN_COMPLETE" | "FINISH" | "RESET";

export type RaceTransition = Readonly<{
  state: RaceState;
  transitioned: boolean;
}>;

export function createInitialRaceState(totalLaps: number = RACE_CONFIG.totalLaps): RaceState {
  return {
    phase: "IDLE",
    countdownRemaining: 0,
    goDisplayRemaining: 0,
    elapsedTime: 0,
    finishTime: null,
    totalLaps,
    completedLaps: 0,
    lapStartTime: 0,
    lapTimes: [],
    expectedCheckpointIndex: 0,
    lastValidMarkerId: "finish",
    previousPosition: null,
    progress: {
      rawTrackFraction: 0,
      validLapFraction: 0,
      raceFraction: 0,
      distanceFromTrack: 0,
      rankingScore: 0,
    },
    respawn: {
      stuckDuration: 0,
      protectionRemaining: 0,
      count: 0,
    },
  };
}

export function transitionRaceState(
  current: RaceState,
  event: RaceTransitionEvent,
): RaceTransition {
  if (event === "RESET") {
    return { state: createInitialRaceState(current.totalLaps), transitioned: true };
  }

  if (current.phase === "IDLE" && event === "START") {
    return {
      state: {
        ...current,
        phase: "COUNTDOWN",
        countdownRemaining: RACE_CONFIG.countdownSeconds,
      },
      transitioned: true,
    };
  }

  if (current.phase === "COUNTDOWN" && event === "COUNTDOWN_COMPLETE") {
    return {
      state: {
        ...current,
        phase: "RACING",
        countdownRemaining: 0,
        goDisplayRemaining: RACE_CONFIG.goDisplaySeconds,
        elapsedTime: 0,
        lapStartTime: 0,
      },
      transitioned: true,
    };
  }

  if (current.phase === "RACING" && event === "FINISH") {
    return {
      state: {
        ...current,
        phase: "FINISHED",
        finishTime: current.elapsedTime,
        goDisplayRemaining: 0,
      },
      transitioned: true,
    };
  }

  return { state: current, transitioned: false };
}

export function getCountdownCue(state: RaceState) {
  if (state.phase === "COUNTDOWN") {
    return String(Math.max(1, Math.ceil(state.countdownRemaining))) as "3" | "2" | "1";
  }
  return state.phase === "RACING" && state.goDisplayRemaining > 0 ? "GO" : null;
}
