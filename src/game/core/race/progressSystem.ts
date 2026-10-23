import { DEFAULT_RACE_TRACK, type Point2 } from "./raceTrack";
import type { RaceProgress } from "./raceTypes";

export type TrackProjection = Readonly<{
  fraction: number;
  distanceFromTrack: number;
}>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function projectOntoRaceRoute(position: Point2, track = DEFAULT_RACE_TRACK, height?: number): TrackProjection {
  let best = Infinity, distance = Infinity, fraction = 0;
  const route = track.RACE_ROUTE_SAMPLES;
  const last = route[route.length - 1], first = route[0];
  const length = last.distance + Math.hypot(last.position[0] - first.position[0], last.position[1] - first.position[1]);
  function project(samples: typeof track.RACE_ROUTE_SAMPLES | typeof track.branches[number]["samples"], closed: boolean, from: number, to: number) {
    for (let i = 0; i < samples.length - (closed ? 0 : 1); i++) {
      const a = samples[i], b = samples[(i + 1) % samples.length];
      const dx = b.position[0] - a.position[0], dz = b.position[1] - a.position[1];
      const length2 = dx * dx + dz * dz;
      const t = clamp(((position[0] - a.position[0]) * dx + (position[1] - a.position[1]) * dz) / length2, 0, 1);
      const horizontal = (position[0] - a.position[0] - t * dx) ** 2 + (position[1] - a.position[1] - t * dz) ** 2;
      const roadHeight = a.height + t * (b.height - a.height);
      const score = horizontal + (height === undefined ? 0 : (roadHeight - height) ** 2);
      if (score >= best) continue;
      best = score; distance = Math.sqrt(horizontal);
      if (closed && "distance" in a && typeof a.distance === "number") {
        fraction = ((a.distance + Math.sqrt(length2) * t) / length) % 1;
      } else {
        fraction = from + (to - from) * (a.progress + (b.progress - a.progress) * t);
      }
    }
  }
  project(route, true, 0, 1);
  for (const branch of track.branches) project(branch.samples, false, branch.entryProgress, branch.exitProgress);
  return { fraction, distanceFromTrack: distance };
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
