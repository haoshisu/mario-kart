import { TRACK_LAYOUT } from "../../track/trackLayout";
import { KART_START } from "../kart/kartConfig";
import { TRACK_CONFIG } from "../../track/trackConfig";
import { TRACK_SAMPLES, type TrackSample } from "../../track/trackPath";
import { RACE_CONFIG } from "./raceConfig";

export type Point2 = readonly [x: number, z: number];

export type RespawnPose = Readonly<{
  position: readonly [x: number, y: number, z: number];
  yaw: number;
}>;

export type RaceMarker = Readonly<{
  id: "finish" | `checkpoint-${number}`;
  kind: "finish" | "checkpoint";
  order: number;
  fraction: number;
  position: Point2;
  forward: Point2;
  right: Point2;
  halfWidth: number;
  halfDepth: number;
  respawn: RespawnPose;
}>;

export type RaceRouteSample = TrackSample & Readonly<{
  distance: number;
  raceProgress: number;
}>;

export type RaceBranch = Readonly<{ samples: readonly TrackSample[]; entryProgress: number; exitProgress: number }>;

export function createRaceTrack(samples: readonly TrackSample[], branches: readonly RaceBranch[] = []) {
  const START_SAMPLE_INDEX = samples.reduce((best, sample, index) => {
    const distance = (point: Point2) => Math.hypot(point[0] - TRACK_LAYOUT.finish[0], point[1] - TRACK_LAYOUT.finish[1]);
    return distance(sample.position) < distance(samples[best].position) ? index : best;
  }, 0);

  function yawFromForward([x, z]: Point2) {
    return Math.atan2(-x, -z);
  }

  function getRotatedSample(index: number) {
    return samples[(START_SAMPLE_INDEX + index) % samples.length];
  }

  function createRouteSamples(): readonly RaceRouteSample[] {
    const rotated = samples.map((_, index) => getRotatedSample(index));
    const cumulative: number[] = [0];
    let totalDistance = 0;

    for (let index = 0; index < rotated.length; index += 1) {
      const current = rotated[index];
      const next = rotated[(index + 1) % rotated.length];
      totalDistance += Math.hypot(
        next.position[0] - current.position[0],
        next.position[1] - current.position[1],
      );
      cumulative.push(totalDistance);
    }

    return rotated.map((sample, index) => ({
      ...sample,
      distance: cumulative[index],
      raceProgress: cumulative[index] / totalDistance,
    }));
  }

  function createMarker(
    id: RaceMarker["id"],
    kind: RaceMarker["kind"],
    order: number,
    fraction: number,
  ): RaceMarker {
    const sampleIndex = Math.round(fraction * RACE_ROUTE_SAMPLES.length) % RACE_ROUTE_SAMPLES.length;
    const sample = RACE_ROUTE_SAMPLES[sampleIndex];
    const forward = sample.tangent;

    return {
      id,
      kind,
      order,
      fraction: sample.raceProgress,
      position: sample.position,
      forward,
      right: sample.normal,
      halfWidth:
        (sample.width ?? TRACK_CONFIG.roadWidth) / 2 +
        TRACK_CONFIG.curbWidth +
        RACE_CONFIG.checkpointExtraWidth,
      halfDepth: RACE_CONFIG.checkpointHalfDepth,
      respawn: {
        position: [sample.position[0], KART_START.position[1] + sample.height, sample.position[1]],
        yaw: yawFromForward(forward),
      },
    };
  }

  const RACE_ROUTE_SAMPLES = createRouteSamples();

  const FINISH_MARKER = createMarker("finish", "finish", -1, 0);

  const CHECKPOINTS = RACE_CONFIG.checkpointFractions.map((fraction, index) =>
    createMarker(`checkpoint-${index + 1}`, "checkpoint", index, fraction),
  );

  const RACE_MARKERS: readonly RaceMarker[] = [FINISH_MARKER, ...CHECKPOINTS];

  return { RACE_ROUTE_SAMPLES, FINISH_MARKER, CHECKPOINTS, RACE_MARKERS, branches };
}
export type RaceTrack = ReturnType<typeof createRaceTrack>;
export const DEFAULT_RACE_TRACK = createRaceTrack(TRACK_SAMPLES);
export const { RACE_ROUTE_SAMPLES, FINISH_MARKER, CHECKPOINTS, RACE_MARKERS } = DEFAULT_RACE_TRACK;

export function getRespawnPose(markerId: RaceMarker["id"], track = DEFAULT_RACE_TRACK): RespawnPose {
  return track.RACE_MARKERS.find((marker) => marker.id === markerId)?.respawn ?? track.FINISH_MARKER.respawn;
}
