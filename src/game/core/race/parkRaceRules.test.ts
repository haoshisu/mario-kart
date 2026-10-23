import { describe, expect, it } from "vitest";
import { getTrackData } from "../../track/trackData";
import { projectOntoRaceRoute } from "./progressSystem";
import { createMarkerCrossingSegment } from "./checkpointSystem";
import { createInitialRaceState, startRace, stepRace } from "./raceEngine";
import type { RaceMarker, Point2 } from "./raceTrack";
import type { RaceState } from "./raceTypes";

const track = getTrackData("meadow"), road = track.race;
const frame = (point: Point2, height: number) => ({ position: [point[0], height + .52, point[1]] as const, signedSpeed: 12, throttle: 1, upY: 1 });
function racing() {
  let state = startRace(createInitialRaceState()).state;
  for (let i = 0; i < 190; i++) state = stepRace(state, frame(road.FINISH_MARKER.position, 0), 1 / 60, road).state;
  return state;
}
function cross(state: RaceState, marker: RaceMarker, height = marker.respawn.position[1] - .52) {
  const segment = createMarkerCrossingSegment(marker, "forward");
  return stepRace({ ...state, previousPosition: segment.previous }, frame(segment.current, height), 1 / 60, road).state;
}

describe("park overpass and legal shortcut progress", () => {
  it("keeps the two crossing roads in their own progress intervals", () => {
    const upper = projectOntoRaceRoute([0, 67.428], road, 16);
    const lower = projectOntoRaceRoute([0, 67.428], road, 3);
    expect(upper.fraction).toBeGreaterThan(.25); expect(upper.fraction).toBeLessThan(.3);
    expect(lower.fraction).toBeGreaterThan(.7); expect(lower.fraction).toBeLessThan(.75);
    expect(upper.distanceFromTrack).toBeLessThan(.2); expect(lower.distanceFromTrack).toBeLessThan(.2);
  });
  it("rejects a checkpoint crossing on the wrong vertical layer", () => {
    expect(cross(racing(), road.CHECKPOINTS[0], 3).expectedCheckpointIndex).toBe(0);
    expect(cross(racing(), road.CHECKPOINTS[0]).expectedCheckpointIndex).toBe(1);
  });
  it("projects the shortcut monotonically and still requires every common checkpoint", () => {
    const branch = track.branches[0];
    let state = cross(cross(racing(), road.CHECKPOINTS[0]), road.CHECKPOINTS[1]);
    let previous = branch.entryProgress;
    for (const point of branch.samples) {
      state = stepRace(state, frame(point.position, point.height), 1 / 60, road).state;
      expect(state.progress.validLapFraction).toBeGreaterThanOrEqual(previous - .002);
      expect(state.expectedCheckpointIndex).toBe(2);
      expect(state.respawn.protectionRemaining).toBe(0);
      previous = state.progress.validLapFraction;
    }
    expect(previous).toBeCloseTo(branch.exitProgress, 2);
    state = cross(state, road.CHECKPOINTS[2]);
    expect(cross(state, road.FINISH_MARKER).completedLaps).toBe(1);
    const skipped = cross(cross(racing(), road.CHECKPOINTS[0]), road.CHECKPOINTS[2]);
    expect(cross(skipped, road.FINISH_MARKER).completedLaps).toBe(0);
  });
});
