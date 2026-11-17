import type { RaceRouteSample } from "../race/raceTrack";
import { circularDistance, routeLength, sampleAtDistance } from "../../track/trackPlacement";
import { TRACK_CONFIG } from "../../track/trackConfig";
import { sampleTrackSurface } from "../../track/trackSurface";

export const ROAD_HAZARD_CONFIG = {
  // Oil slicks per lap; each covers one side of the road so a clean line always exists.
  perLap: 4, radius: 1.05, edgeInset: 1.65,
  firstDistance: 60, finishClearance: 40, minimumSpacing: 70,
  clearance: 18, rampApproach: 12, rampLanding: 60,
} as const;

export type RoadHazard = Readonly<{ id: string; position: readonly [number, number]; height: number; lane: number; distance: number }>;

/**
 * Static slicks sit away from supply rows, pads, ramps and moving obstacles, on
 * alternating sides. Positions are shared by the server rules and the renderer.
 */
export function createRoadHazards(route: readonly RaceRouteSample[], avoid: Readonly<{
  distances: readonly number[]; rampDistances: readonly number[];
  /** Race-progress spans where an alternate route runs beside or across the main road. */
  progressRanges?: readonly (readonly [number, number])[];
}>): readonly RoadHazard[] {
  const config = ROAD_HAZARD_CONFIG, length = routeLength(route);
  const candidates = route.filter(point => {
    if (point.distance < config.firstDistance || point.distance > length - config.finishClearance) return false;
    const margin = config.clearance / length;
    if (avoid.progressRanges?.some(([from, to]) => point.raceProgress > from - margin && point.raceProgress < to + margin)) return false;
    if (avoid.distances.some(distance => circularDistance(point.distance, distance, length) < config.clearance)) return false;
    return avoid.rampDistances.every(distance => {
      const ahead = (point.distance - distance + length) % length;
      return ahead >= config.rampLanding && ahead <= length - config.rampApproach;
    });
  });
  const hazards: RoadHazard[] = [];
  for (let index = 0; index < config.perLap; index++) {
    const target = config.firstDistance + (length - config.finishClearance - config.firstDistance) * (index + .5) / config.perLap;
    let chosen: RaceRouteSample | undefined, best = Infinity;
    for (const point of candidates) {
      if (hazards.some(hazard => circularDistance(hazard.distance, point.distance, length) < config.minimumSpacing)) continue;
      const cost = Math.abs(point.distance - target);
      if (cost < best) { best = cost; chosen = point; }
    }
    if (!chosen) continue;
    const width = Math.min(chosen.width ?? TRACK_CONFIG.roadWidth,
      sampleAtDistance(route, chosen.distance - 2).width ?? TRACK_CONFIG.roadWidth,
      sampleAtDistance(route, chosen.distance + 2).width ?? TRACK_CONFIG.roadWidth);
    const lane = (index % 2 ? 1 : -1) * (width / 2 - config.edgeInset);
    const position = [chosen.position[0] + chosen.normal[0] * lane, chosen.position[1] + chosen.normal[1] * lane] as const;
    const height = sampleTrackSurface(...position, route, undefined, { height: chosen.height }).height;
    hazards.push({ id: `hazard-${index}`, position, height, lane, distance: chosen.distance });
  }
  return hazards.sort((a, b) => a.distance - b.distance);
}

export const isHazardSource = (sourceId: string) => sourceId.startsWith("hazard-");
