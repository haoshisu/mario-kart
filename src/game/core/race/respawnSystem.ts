import { RACE_CONFIG } from "./raceConfig";
import { getRespawnPose, DEFAULT_RACE_TRACK } from "./raceTrack";
import type { RaceState, RaceStepInput, RespawnReason } from "./raceTypes";

export type RespawnEvaluation = Readonly<{
  state: RaceState["respawn"];
  reason: RespawnReason | null;
}>;

export function evaluateRespawn(
  current: RaceState["respawn"],
  input: RaceStepInput,
  distanceFromTrack: number,
  deltaTime: number,
): RespawnEvaluation {
  const protectionRemaining = Math.max(0, current.protectionRemaining - deltaTime);
  if (protectionRemaining > 0) {
    return {
      state: { ...current, protectionRemaining, stuckDuration: 0 },
      reason: null,
    };
  }

  let reason: RespawnReason | null = null;
  if (
    input.position[1] < RACE_CONFIG.respawn.minimumHeight ||
    distanceFromTrack > RACE_CONFIG.respawn.maximumTrackDistance
  ) {
    reason = "out-of-bounds";
  } else if (input.upY < RACE_CONFIG.respawn.flippedUpThreshold) {
    reason = "flipped";
  }

  const stuck =
    input.throttle >= RACE_CONFIG.respawn.minimumThrottle &&
    Math.abs(input.signedSpeed) <= RACE_CONFIG.respawn.stuckSpeed;
  const stuckDuration = stuck ? current.stuckDuration + deltaTime : 0;
  if (!reason && stuckDuration >= RACE_CONFIG.respawn.stuckSeconds) {
    reason = "stuck";
  }

  return {
    state: {
      ...current,
      protectionRemaining,
      stuckDuration,
    },
    reason,
  };
}

export function applyRespawnProtection(state: RaceState, reason: RespawnReason, track = DEFAULT_RACE_TRACK) {
  const pose = getRespawnPose(state.lastValidMarkerId, track);
  return {
    state: {
      ...state,
      previousPosition: [pose.position[0], pose.position[2]] as const,
      respawn: {
        stuckDuration: 0,
        protectionRemaining: RACE_CONFIG.respawn.protectionSeconds,
        count: state.respawn.count + 1,
      },
    },
    respawn: { reason, pose },
  } as const;
}
