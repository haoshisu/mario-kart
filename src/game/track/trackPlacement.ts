import type { RaceRouteSample } from "../core/race/raceTrack";
import { sampleTrackSurface, surfaceOffsetHeight } from "./trackSurface";
import { TRACK_CONFIG } from "./trackConfig";

export function routeLength(route: readonly RaceRouteSample[]) {
  const first = route[0], last = route[route.length - 1];
  return last.distance + Math.hypot(first.position[0] - last.position[0], first.position[1] - last.position[1]);
}

export function sampleAtDistance(route: readonly RaceRouteSample[], distance: number) {
  const length = routeLength(route), wrapped = ((distance % length) + length) % length;
  let best = route[0];
  for (const sample of route) {
    if (Math.abs(sample.distance - wrapped) < Math.abs(best.distance - wrapped)) best = sample;
  }
  return best;
}

export function circularDistance(a: number, b: number, length: number) {
  const distance = Math.abs(a - b);
  return Math.min(distance, length - distance);
}

export const RUNWAY_CONFIG = {
  gravity: 9.81, speeds: [6, 17, 23], step: .04, maximumFlight: 2.5,
  recoveryDistance: 10, edgeClearance: .65, maximumGrade: .15,
} as const;

/** Validate the unsteered trajectory against the actual banked/sloping road.
 * Reward lanes must be survivable at Turbo speed without mid-air correction.
 */
export function evaluateJumpRunway(route: readonly RaceRouteSample[], point: RaceRouteSample,
  lane: number, rise: number, launchSpeed: number) {
  const x = point.position[0] + point.normal[0] * lane;
  const z = point.position[1] + point.normal[1] * lane;
  const origin = sampleTrackSurface(x, z, route, undefined, { height: point.height });
  const grade = origin.gradientX * point.tangent[0] + origin.gradientZ * point.tangent[1];
  if (Math.abs(grade) > RUNWAY_CONFIG.maximumGrade) return undefined;
  let maximumFlightSeconds = 0;
  for (const speed of RUNWAY_CONFIG.speeds) {
    let landed = false;
    for (let t = RUNWAY_CONFIG.step; t <= RUNWAY_CONFIG.maximumFlight; t += RUNWAY_CONFIG.step) {
      const distance = speed * t;
      const px = x + point.tangent[0] * distance, pz = z + point.tangent[1] * distance;
      const height = surfaceOffsetHeight(point, lane) + rise + launchSpeed * t - RUNWAY_CONFIG.gravity * t * t / 2;
      const surface = sampleTrackSurface(px, pz, route, undefined, { height });
      if (t < launchSpeed / RUNWAY_CONFIG.gravity || height > surface.height) continue;
      if (surface.distance > (surface.width ?? TRACK_CONFIG.roadWidth) / 2 - RUNWAY_CONFIG.edgeClearance) return undefined;
      const landingGrade = surface.gradientX * point.tangent[0] + surface.gradientZ * point.tangent[1];
      if (Math.abs(landingGrade) > RUNWAY_CONFIG.maximumGrade) return undefined;
      for (let ahead = 0; ahead <= RUNWAY_CONFIG.recoveryDistance; ahead += 2) {
        const recovery = sampleTrackSurface(px + point.tangent[0] * ahead, pz + point.tangent[1] * ahead, route, undefined, { height: surface.height });
        if (recovery.distance > (recovery.width ?? TRACK_CONFIG.roadWidth) / 2 - RUNWAY_CONFIG.edgeClearance) return undefined;
      }
      maximumFlightSeconds = Math.max(maximumFlightSeconds, t);
      landed = true;
      break;
    }
    if (!landed) return undefined;
  }
  return { maximumFlightSeconds };
}
