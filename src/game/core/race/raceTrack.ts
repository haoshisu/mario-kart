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

const START_SAMPLE_INDEX = Math.round(TRACK_CONFIG.straightSegments / 4);

function yawFromForward([x, z]: Point2) {
  return Math.atan2(-x, -z);
}

function getRotatedSample(index: number) {
  return TRACK_SAMPLES[(START_SAMPLE_INDEX + index) % TRACK_SAMPLES.length];
}

function createRouteSamples(): readonly RaceRouteSample[] {
  const rotated = TRACK_SAMPLES.map((_, index) => getRotatedSample(index));
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
    fraction,
    position: sample.position,
    forward,
    right: sample.normal,
    halfWidth:
      TRACK_CONFIG.roadWidth / 2 +
      TRACK_CONFIG.curbWidth +
      RACE_CONFIG.checkpointExtraWidth,
    halfDepth: RACE_CONFIG.checkpointHalfDepth,
    respawn: {
      position: [sample.position[0], KART_START.position[1], sample.position[1]],
      yaw: yawFromForward(forward),
    },
  };
}

export const RACE_ROUTE_SAMPLES = createRouteSamples();

export const FINISH_MARKER = createMarker("finish", "finish", -1, 0);

export const CHECKPOINTS = RACE_CONFIG.checkpointFractions.map((fraction, index) =>
  createMarker(`checkpoint-${index + 1}`, "checkpoint", index, fraction),
);

export const RACE_MARKERS: readonly RaceMarker[] = [FINISH_MARKER, ...CHECKPOINTS];

export function getRespawnPose(markerId: RaceMarker["id"]): RespawnPose {
  return RACE_MARKERS.find((marker) => marker.id === markerId)?.respawn ?? FINISH_MARKER.respawn;
}
