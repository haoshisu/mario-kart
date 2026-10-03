import { DEFAULT_RACE_TRACK, type Point2 } from "./raceTrack";
import type { RaceProgress } from "./raceTypes";

export type TrackProjection = Readonly<{
  fraction: number;
  distanceFromTrack: number;
}>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function projectOntoRaceRoute(position: Point2, track = DEFAULT_RACE_TRACK): TrackProjection {
  const { RACE_ROUTE_SAMPLES } = track;
  const last = RACE_ROUTE_SAMPLES[RACE_ROUTE_SAMPLES.length - 1];
  const first = RACE_ROUTE_SAMPLES[0];
  const ROUTE_LENGTH = last.distance + Math.hypot(last.position[0] - first.position[0], last.position[1] - first.position[1]);
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  let nearestDistanceAlongRoute = 0;

  for (let index = 0; index < RACE_ROUTE_SAMPLES.length; index += 1) {
    const current = RACE_ROUTE_SAMPLES[index];
    const next = RACE_ROUTE_SAMPLES[(index + 1) % RACE_ROUTE_SAMPLES.length];
    const segmentX = next.position[0] - current.position[0];
    const segmentZ = next.position[1] - current.position[1];
    const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ;
    const projection = clamp(
      ((position[0] - current.position[0]) * segmentX +
        (position[1] - current.position[1]) * segmentZ) /
        segmentLengthSquared,
      0,
      1,
    );
    const projectedX = current.position[0] + segmentX * projection;
    const projectedZ = current.position[1] + segmentZ * projection;
    const distanceSquared =
      (position[0] - projectedX) ** 2 + (position[1] - projectedZ) ** 2;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestDistanceAlongRoute =
        current.distance + Math.sqrt(segmentLengthSquared) * projection;
    }
  }

  return {
    fraction: (nearestDistanceAlongRoute / ROUTE_LENGTH) % 1,
    distanceFromTrack: Math.sqrt(nearestDistanceSquared),
  };
}

export function calculateRaceProgress(
  completedLaps: number,
  expectedCheckpointIndex: number,
  totalLaps: number,
  projection: TrackProjection,
  track = DEFAULT_RACE_TRACK,
): RaceProgress {
  const { CHECKPOINTS } = track;
  const previousFraction =
    expectedCheckpointIndex === 0
      ? 0
      : CHECKPOINTS[expectedCheckpointIndex - 1]?.fraction ?? CHECKPOINTS.at(-1)?.fraction ?? 0;
  const nextFraction = CHECKPOINTS[expectedCheckpointIndex]?.fraction ?? 1;
  const normalizedFraction =
    expectedCheckpointIndex === 0 && projection.fraction > 0.75
      ? 0
      : projection.fraction;
  const validLapFraction = clamp(normalizedFraction, previousFraction, nextFraction);
  const rankingScore = completedLaps + validLapFraction;

  return {
    rawTrackFraction: projection.fraction,
    validLapFraction,
    raceFraction: clamp(rankingScore / totalLaps, 0, 1),
    distanceFromTrack: projection.distanceFromTrack,
    rankingScore,
  };
}

export type RacerProgress = Readonly<{
  racerId: string;
  completedLaps: number;
  expectedCheckpointIndex: number;
  trackFraction: number;
}>;

export function getRacerRankingScore(progress: RacerProgress) {
  const projection = { fraction: progress.trackFraction, distanceFromTrack: 0 };
  return calculateRaceProgress(
    progress.completedLaps,
    progress.expectedCheckpointIndex,
    Number.MAX_SAFE_INTEGER,
    projection,
  ).rankingScore;
}

export function rankRacers(progress: readonly RacerProgress[]) {
  return [...progress].sort(
    (first, second) => getRacerRankingScore(second) - getRacerRankingScore(first),
  );
}
