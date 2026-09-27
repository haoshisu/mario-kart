import { describe, expect, it } from "vitest";
import { createMarkerCrossingSegment } from "./checkpointSystem";
import { CHECKPOINTS, FINISH_MARKER, type RaceMarker } from "./raceTrack";
import { createInitialRaceState, startRace, stepRace } from "./raceEngine";
import type { RaceState } from "./raceTypes";

const DT = 1 / 60;

function frame(position: readonly [number, number], overrides: Partial<Parameters<typeof stepRace>[1]> = {}) {
  return {
    position: [position[0], 0.52, position[1]] as const,
    signedSpeed: 8,
    throttle: 1,
    upY: 1,
    ...overrides,
  };
}

function beginRacing() {
  let state = startRace(createInitialRaceState()).state;
  while (state.phase === "COUNTDOWN") {
    state = stepRace(state, frame(FINISH_MARKER.position), DT).state;
  }
  return state;
}

function cross(state: RaceState, marker: RaceMarker, direction: "forward" | "reverse" = "forward") {
  const segment = createMarkerCrossingSegment(marker, direction);
  const before = stepRace(
    { ...state, previousPosition: segment.previous },
    frame(segment.previous),
    DT,
  ).state;
  return stepRace(before, frame(segment.current), DT);
}

describe("raceEngine", () => {
  it("counts down, starts at zero, and freezes time after finish", () => {
    let state = startRace(createInitialRaceState()).state;
    expect(state.phase).toBe("COUNTDOWN");
    expect(state.elapsedTime).toBe(0);

    while (state.phase === "COUNTDOWN") {
      state = stepRace(state, frame(FINISH_MARKER.position), DT).state;
      expect(state.elapsedTime).toBe(0);
    }
    expect(state.phase).toBe("RACING");

    for (let lap = 0; lap < state.totalLaps; lap += 1) {
      for (const checkpoint of CHECKPOINTS) state = cross(state, checkpoint).state;
      state = cross(state, FINISH_MARKER).state;
    }
    expect(state.phase).toBe("FINISHED");
    const finishTime = state.finishTime;
    state = stepRace(state, frame(FINISH_MARKER.position), 0.05).state;
    expect(state.elapsedTime).toBe(finishTime);
    expect(state.finishTime).toBe(finishTime);
  });

  it("requires checkpoint order and ignores repeats, skips, and reverse finish crossings", () => {
    let state = beginRacing();
    state = cross(state, FINISH_MARKER).state;
    state = cross(state, FINISH_MARKER).state;
    expect(state.completedLaps).toBe(0);
    expect(state.expectedCheckpointIndex).toBe(0);

    state = cross(state, CHECKPOINTS[1]).state;
    expect(state.expectedCheckpointIndex).toBe(0);

    state = cross(state, CHECKPOINTS[0]).state;
    expect(state.expectedCheckpointIndex).toBe(1);
    state = cross(state, CHECKPOINTS[0]).state;
    expect(state.expectedCheckpointIndex).toBe(1);

    state = cross(state, CHECKPOINTS[1]).state;
    state = cross(state, CHECKPOINTS[2]).state;
    const reverseFinish = cross(state, FINISH_MARKER, "reverse").state;
    expect(reverseFinish.completedLaps).toBe(0);
    expect(reverseFinish.expectedCheckpointIndex).toBe(CHECKPOINTS.length);

    const validFinish = cross(reverseFinish, FINISH_MARKER).state;
    expect(validFinish.completedLaps).toBe(1);
    expect(validFinish.expectedCheckpointIndex).toBe(0);
  });

  it("locks all lap results on the final finish", () => {
    let state = beginRacing();
    for (let lap = 0; lap < state.totalLaps; lap += 1) {
      for (const checkpoint of CHECKPOINTS) state = cross(state, checkpoint).state;
      state = cross(state, FINISH_MARKER).state;
    }

    expect(state.phase).toBe("FINISHED");
    expect(state.completedLaps).toBe(state.totalLaps);
    expect(state.lapTimes).toHaveLength(state.totalLaps);
    expect(state.finishTime).toBe(state.elapsedTime);
  });

  it("keeps checkpoint progress through respawn without awarding another gate", () => {
    let state = beginRacing();
    state = cross(state, CHECKPOINTS[0]).state;
    const result = stepRace(
      state,
      frame([0, 0], { position: [0, -2, 0] }),
      DT,
    );

    expect(result.respawn?.reason).toBe("out-of-bounds");
    expect(result.state.expectedCheckpointIndex).toBe(1);
    expect(result.state.completedLaps).toBe(0);
    expect(result.state.previousPosition).toEqual([
      CHECKPOINTS[0].respawn.position[0],
      CHECKPOINTS[0].respawn.position[2],
    ]);
  });
});
