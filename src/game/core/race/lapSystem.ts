import { CHECKPOINTS, FINISH_MARKER, type RaceMarker } from "./raceTrack";
import type { RaceEvent, RaceState } from "./raceTypes";

export type LapUpdate = Readonly<{
  state: RaceState;
  events: readonly RaceEvent[];
  finished: boolean;
}>;

export function applyMarkerCrossing(
  current: RaceState,
  marker: RaceMarker,
  direction: "forward" | "reverse",
): LapUpdate {
  if (current.phase !== "RACING" || direction !== "forward") {
    return { state: current, events: [], finished: false };
  }

  if (marker.kind === "checkpoint") {
    const expected = CHECKPOINTS[current.expectedCheckpointIndex];
    if (!expected || marker.id !== expected.id) {
      return { state: current, events: [], finished: false };
    }

    return {
      state: {
        ...current,
        expectedCheckpointIndex: current.expectedCheckpointIndex + 1,
        lastValidMarkerId: marker.id,
      },
      events: [{ type: "CHECKPOINT_PASSED", checkpointId: marker.id }],
      finished: false,
    };
  }

  if (
    marker.id !== FINISH_MARKER.id ||
    current.expectedCheckpointIndex !== CHECKPOINTS.length
  ) {
    return { state: current, events: [], finished: false };
  }

  const completedLaps = current.completedLaps + 1;
  const lapTime = Math.max(0, current.elapsedTime - current.lapStartTime);
  const finished = completedLaps >= current.totalLaps;
  const events: RaceEvent[] = [
    { type: "LAP_COMPLETED", lap: completedLaps, lapTime },
  ];

  if (finished) {
    events.push({ type: "RACE_FINISHED", finishTime: current.elapsedTime });
  }

  return {
    state: {
      ...current,
      completedLaps,
      expectedCheckpointIndex: 0,
      lastValidMarkerId: FINISH_MARKER.id,
      lapStartTime: current.elapsedTime,
      lapTimes: [...current.lapTimes, lapTime],
    },
    events,
    finished,
  };
}
