import type { RaceRouteSample } from "../race/raceTrack";
import type { JumpRamp } from "../stunts/stuntSystem";
import { routeLength, sampleAtDistance, circularDistance } from "../../track/trackPlacement";
import { TRACK_CONFIG } from "../../track/trackConfig";
import { roadOrientation, sampleTrackSurface } from "../../track/trackSurface";

export const ITEM_ROW_CONFIG = {
  // Fewer rows make each supply gate a decision instead of a constant refill.
  targetSpacing: 175, minimumRows: 4, maximumRows: 7, minimumSpacing: 45,
  firstRowDistance: 40, finishClearance: 25, edgeClearance: .65,
  maximumColumnSpacing: 1.25, minimumColumns: 4,
  rampApproachClearance: 8, rampLandingClearance: 68, obstacleClearance: 16,
  cornerLookAhead: 8, maximumCornerAngle: .55,
} as const;

/** Supply gates follow the actual road width. Jump runways remain separate from
 * item rewards, so a full-width row never sits inside a launch or landing. */
export function createItemRows(route: readonly RaceRouteSample[], ramps: readonly JumpRamp[] = [], obstacleFractions: readonly number[] = []) {
  const config = ITEM_ROW_CONFIG, length = routeLength(route);
  const nearestRamp = ramps.map(ramp => route.reduce((best, point) =>
    Math.hypot(point.position[0] - ramp.position[0], point.position[1] - ramp.position[1]) <
    Math.hypot(best.position[0] - ramp.position[0], best.position[1] - ramp.position[1]) ? point : best).distance);
  const candidates = route.filter(point => {
    if (point.distance < config.firstRowDistance || point.distance > length - config.finishClearance) return false;
    for (const distance of nearestRamp) {
      const ahead = (point.distance - distance + length) % length;
      if (ahead < config.rampLandingClearance || ahead > length - config.rampApproachClearance) return false;
    }
    if (obstacleFractions.some(fraction => circularDistance(point.distance, fraction * length, length) < config.obstacleClearance)) return false;
    const before = sampleAtDistance(route, point.distance - config.cornerLookAhead), after = sampleAtDistance(route, point.distance + config.cornerLookAhead);
    return before.tangent[0] * after.tangent[0] + before.tangent[1] * after.tangent[1] >= Math.cos(config.maximumCornerAngle);
  });
  const count = Math.max(config.minimumRows, Math.min(config.maximumRows, Math.round(length / config.targetSpacing)));
  const rows: RaceRouteSample[] = [];
  for (let index = 0; index < count; index++) {
    const target = config.firstRowDistance + (length - config.finishClearance - config.firstRowDistance) * index / (count - 1);
    let chosen: RaceRouteSample | undefined, best = Infinity;
    for (const point of candidates) {
      if (rows.some(row => circularDistance(row.distance, point.distance, length) < config.minimumSpacing)) continue;
      const cost = Math.abs(point.distance - target);
      if (cost < best) { chosen = point; best = cost; }
    }
    if (!chosen) throw new Error("Track has no safe item supply row");
    rows.push(chosen);
  }
  return rows.sort((a, b) => a.distance - b.distance).flatMap((point, row) => {
    // Leave room through a taper, including the rotating cube's outer corners.
    const width = Math.min(point.width ?? TRACK_CONFIG.roadWidth,
      sampleAtDistance(route, point.distance - 2).width ?? TRACK_CONFIG.roadWidth,
      sampleAtDistance(route, point.distance + 2).width ?? TRACK_CONFIG.roadWidth);
    const halfSpan = width / 2 - config.edgeClearance;
    const columns = Math.max(config.minimumColumns, Math.ceil(halfSpan * 2 / config.maximumColumnSpacing) + 1);
    return Array.from({ length: columns }, (_, column) => {
      const lane = -halfSpan + halfSpan * 2 * column / (columns - 1);
      const position = [point.position[0] + point.normal[0] * lane, point.position[1] + point.normal[1] * lane] as const;
      const yaw = Math.atan2(-point.tangent[0], -point.tangent[1]);
      const surface = sampleTrackSurface(...position, route, undefined, { height: point.height });
      return { id: `box-${row}-${column}`, row, lane, rowDistance: point.distance, rowWidth: width,
        position, height: surface.height, yaw, ...roadOrientation(yaw, surface) };
    });
  });
}
