import { isTaiwanTrack } from "./taiwanTracks";
import { MEADOW_PARK_OBSTACLE } from "./meadowPark";
import type { RaceRouteSample } from "../core/race/raceTrack";
import { surfaceOffsetHeight } from "./trackSurface";
import { routeLength, sampleAtDistance } from "./trackPlacement";
import { PARK_OBSTACLE_FRACTIONS } from "./themeParks";
import type { TrackId } from "./trackCatalog";
import type { TrackSample } from "./trackPath";

export const TAIPEI_CROSSING_TIMING = { halfCycle: 6, warningAt: 2, crossingAt: 4, clearance: 14 } as const;
export function crossingPhase(seconds: number) {
  const time = seconds % TAIPEI_CROSSING_TIMING.halfCycle;
  return time < TAIPEI_CROSSING_TIMING.warningAt ? "clear" : time < TAIPEI_CROSSING_TIMING.crossingAt ? "warning" : "crossing";
}

export const PARK_OBSTACLE_CONFIG = { fraction: MEADOW_PARK_OBSTACLE.fraction, period: MEADOW_PARK_OBSTACLE.period, amplitude: MEADOW_PARK_OBSTACLE.lateralAmplitude, center: MEADOW_PARK_OBSTACLE.lateralCenter,
  halfWidth: .75, halfHeight: .6, halfLength: 1 } as const;
export function createParkObstacle(route: readonly RaceRouteSample[], id: TrackId = "meadow", crossingRoute?: readonly TrackSample[]) {
  const crossing = id === "taipei" && crossingRoute ? crossingRoute[Math.floor(crossingRoute.length / 2)] : undefined;
  const sample = sampleAtDistance(route, routeLength(route) * PARK_OBSTACLE_FRACTIONS[id]);
  const kind = id === "taipei" || id === "alishan" ? "train" : id === "jiufen" ? "mine" : id === "kaohsiung" ? "cargo" : "cart";
  const dimensions = kind === "train" ? { halfWidth: .7, halfHeight: .8, halfLength: 2.5 }
    : kind === "cargo" ? { halfWidth: .85, halfHeight: .7, halfLength: 1.5 } : PARK_OBSTACLE_CONFIG;
  return { sample, route, id, kind, dimensions, crossing,
    yaw: Math.atan2(-(crossing ?? sample).tangent[0], -(crossing ?? sample).tangent[1]) + (crossing ? Math.PI / 2 : 0) };
}
export type ParkObstacle = ReturnType<typeof createParkObstacle>;
export function parkObstaclePose(obstacle: ParkObstacle, seconds: number, out = { x: 0, y: 0, z: 0 }) {
  if (obstacle.crossing) {
    const half = Math.floor(seconds / TAIPEI_CROSSING_TIMING.halfCycle);
    const t = seconds % TAIPEI_CROSSING_TIMING.halfCycle;
    const progress = Math.max(0, (t - TAIPEI_CROSSING_TIMING.crossingAt) / 2);
    const offset = (-1 + progress * 2) * TAIPEI_CROSSING_TIMING.clearance * (half % 2 ? -1 : 1);
    const sample = obstacle.crossing;
    out.x = sample.position[0] + sample.normal[0] * offset;
    out.z = sample.position[1] + sample.normal[1] * offset;
    out.y = sample.height + obstacle.dimensions.halfHeight;
    return out;
  }
  const lane = PARK_OBSTACLE_CONFIG.center + (isTaiwanTrack(obstacle.id) ? 0 : Math.sin(seconds * Math.PI * 2 / PARK_OBSTACLE_CONFIG.period) * PARK_OBSTACLE_CONFIG.amplitude);
  const movingRail = obstacle.kind === "train" || obstacle.kind === "mine";
  const sample = movingRail ? sampleAtDistance(obstacle.route, obstacle.sample.distance + Math.sin(seconds * Math.PI * 2 / 9) * 8) : obstacle.sample;
  const lift = obstacle.kind === "cargo" ? (1 - Math.cos(seconds * Math.PI * 2 / 8)) * 2.5 : 0;
  out.x = sample.position[0] + sample.normal[0] * lane;
  out.z = sample.position[1] + sample.normal[1] * lane;
  out.y = surfaceOffsetHeight(sample, lane) + obstacle.dimensions.halfHeight + lift;
  return out;
}

export function parkObstacleYaw(obstacle: ParkObstacle, seconds: number) {
  if (obstacle.crossing) return obstacle.yaw;
  if (obstacle.kind !== "train" && obstacle.kind !== "mine") return obstacle.yaw;
  const sample = sampleAtDistance(obstacle.route, obstacle.sample.distance + Math.sin(seconds * Math.PI * 2 / 9) * 8);
  return Math.atan2(-sample.tangent[0], -sample.tangent[1]);
}
