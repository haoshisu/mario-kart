import type { RaceRouteSample } from "../core/race/raceTrack";
import type { KartHandling } from "../core/kart/kartPhysics";
import { routeLength, sampleAtDistance } from "./trackPlacement";
import type { createSurfaceResult } from "./trackSurface";
import { TRACK_CONFIG } from "./trackConfig";

export const ROUGH_CONFIG = {
  // Inside strip of a sharp bend: cutting the apex costs speed unless a boost carries the kart.
  stripWidth: 1.7, turnWindow: 9, minimumTurn: .5, minimumLength: 8,
  startClearance: .04, rangeMargin: .015,
  handling: { drag: 1.5, grip: .8 } satisfies KartHandling,
} as const;

/** `side` uses the road's lateral sign: +1 is the (-tangentZ, tangentX) side. */
export type RoughZone = Readonly<{ from: number; to: number; side: 1 | -1 }>;

export function createRoughZones(route: readonly RaceRouteSample[], excluded: readonly (readonly [number, number])[] = []): readonly RoughZone[] {
  const config = ROUGH_CONFIG, length = routeLength(route);
  const zones: { from: number; to: number; side: 1 | -1; start: number; end: number }[] = [];
  for (const point of route) {
    const progress = point.raceProgress;
    if (progress < config.startClearance || progress > 1 - config.startClearance) continue;
    if (excluded.some(([from, to]) => progress > from - config.rangeMargin && progress < to + config.rangeMargin)) continue;
    const before = sampleAtDistance(route, point.distance - config.turnWindow), after = sampleAtDistance(route, point.distance + config.turnWindow);
    const turn = Math.atan2(before.tangent[0] * after.tangent[1] - before.tangent[1] * after.tangent[0],
      before.tangent[0] * after.tangent[0] + before.tangent[1] * after.tangent[1]);
    if (Math.abs(turn) < config.minimumTurn) continue;
    const side = turn > 0 ? 1 : -1;
    const last = zones.at(-1);
    if (last && last.side === side && point.distance - last.end <= 1.5) { last.to = progress; last.end = point.distance; }
    else zones.push({ from: progress, to: progress, side, start: point.distance, end: point.distance });
  }
  return zones.filter(zone => zone.end - zone.start >= Math.min(config.minimumLength, length)).map(({ from, to, side }) => ({ from, to, side }));
}

/** Main-road only: shortcuts keep their own themed handling. */
export function roughHandling(zones: readonly RoughZone[], surface: ReturnType<typeof createSurfaceResult>): KartHandling | undefined {
  if ((surface.routeIndex ?? 0) > 0 || surface.progress === undefined || surface.lateral === undefined) return;
  const edge = (surface.width ?? TRACK_CONFIG.roadWidth) / 2;
  for (const zone of zones) {
    if (surface.progress < zone.from || surface.progress > zone.to) continue;
    if (surface.lateral * zone.side > edge - ROUGH_CONFIG.stripWidth) return ROUGH_CONFIG.handling;
  }
}
