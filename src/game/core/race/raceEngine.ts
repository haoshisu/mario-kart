import { getMarkerCrossingDirection } from "./checkpointSystem";
import { applyMarkerCrossing } from "./lapSystem";
import { calculateRaceProgress, projectOntoRaceRoute } from "./progressSystem";
import { RACE_CONFIG } from "./raceConfig";
import { DEFAULT_RACE_TRACK } from "./raceTrack";
import {
  createInitialRaceState,
  transitionRaceState,
} from "./raceStateMachine";
import { applyRespawnProtection, evaluateRespawn } from "./respawnSystem";
import type { RaceEvent, RaceState, RaceStepInput, RaceStepResult } from "./raceTypes";

export { createInitialRaceState } from "./raceStateMachine";

function clampDelta(deltaTime: number) {
  return Math.max(0, Math.min(deltaTime, RACE_CONFIG.maximumStepSeconds));
}

export function startRace(current: RaceState) {
  const transition = transitionRaceState(current, "START");
  return {
    state: transition.state,
    events: transition.transitioned
      ? ([{ type: "COUNTDOWN_STARTED" }] as const satisfies readonly RaceEvent[])
      : [],
  };
}

export function restartRace() {
  return startRace(createInitialRaceState());
}

function updateProgress(state: RaceState, position: readonly [number, number], track = DEFAULT_RACE_TRACK) {
  const projection = projectOntoRaceRoute(position, track);
  return {
    state: {
      ...state,
      progress: calculateRaceProgress(
        state.completedLaps,
        state.expectedCheckpointIndex,
        state.totalLaps,
        projection,
        track,
      ),
    },
    projection,
  };
}

export function stepRace(
  current: RaceState,
  input: RaceStepInput,
  deltaTime: number,
  track = DEFAULT_RACE_TRACK,
): RaceStepResult {
  const dt = clampDelta(deltaTime);
  const position = [input.position[0], input.position[2]] as const;
  let state = current;
  const events: RaceEvent[] = [];

  if (state.phase === "IDLE" || state.phase === "FINISHED") {
    const progress = updateProgress({ ...state, previousPosition: position }, position, track);
    return { state: progress.state, events, respawn: null };
  }

  if (state.phase === "COUNTDOWN") {
    const countdownRemaining = Math.max(0, state.countdownRemaining - dt);
    state = { ...state, countdownRemaining, previousPosition: position };
    if (countdownRemaining === 0) {
      const transition = transitionRaceState(state, "COUNTDOWN_COMPLETE");
      state = transition.state;
      if (transition.transitioned) {
        events.push({ type: "RACE_STARTED" });
      }
    }
    const progress = updateProgress(state, position, track);
    return { state: progress.state, events, respawn: null };
  }

  state = {
    ...state,
    elapsedTime: state.elapsedTime + dt,
    goDisplayRemaining: Math.max(0, state.goDisplayRemaining - dt),
  };

  const progressUpdate = updateProgress(state, position, track);
  state = progressUpdate.state;
  const respawnEvaluation = evaluateRespawn(
    state.respawn,
    input,
    progressUpdate.projection.distanceFromTrack,
    dt,
  );
  state = { ...state, respawn: respawnEvaluation.state };

  if (respawnEvaluation.reason) {
    const result = applyRespawnProtection(state, respawnEvaluation.reason, track);
    const event = {
      type: "RESPAWN",
      reason: result.respawn.reason,
      pose: result.respawn.pose,
    } as const;
    return {
      state: result.state,
      events: [...events, event],
      respawn: result.respawn,
    };
  }

  const previous = state.previousPosition;
  const canTriggerMarkers = state.respawn.protectionRemaining <= 0;
  if (previous && canTriggerMarkers) {
    for (const marker of track.RACE_MARKERS) {
      const direction = getMarkerCrossingDirection(marker, previous, position);
      if (!direction) {
        continue;
      }

      const lapUpdate = applyMarkerCrossing(state, marker, direction, track);
      state = lapUpdate.state;
      events.push(...lapUpdate.events);
      if (lapUpdate.finished) {
        state = transitionRaceState(state, "FINISH").state;
        break;
      }
    }
  }

  state = { ...state, previousPosition: position };
  state = updateProgress(state, position, track).state;

  return { state, events, respawn: null };
}

export function getNextRaceMarker(state: RaceState, track = DEFAULT_RACE_TRACK) {
  return track.CHECKPOINTS[state.expectedCheckpointIndex] ?? track.FINISH_MARKER;
}
