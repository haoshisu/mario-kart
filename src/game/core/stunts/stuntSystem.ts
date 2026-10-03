import { KART_START } from "../kart/kartConfig";
import { TRACK_CONFIG } from "../../track/trackConfig";
import type { KartSimulationState } from "../kart/kartTypes";
import type { RaceRouteSample } from "../race/raceTrack";
import type { TrackId } from "../../track/trackCatalog";
import { roadOrientation, sampleTrackSurface, type createSurfaceResult } from "../../track/trackSurface";

export const STUNT_CONFIG = { length: 4, width: 3.4, rise: .8, launchSpeed: 5.5,
  minimumSpeed: 6, minimumForwardDot: .7, airSteering: .45, cooldown: 2, spinSeconds: .85,
  landingBoostSeconds: .8, maximumAirSeconds: 4 } as const;
export type StuntState = { active: boolean; elapsed: number; cooldown: number;
  previousX: number; previousZ: number; initialized: boolean };
export function createStuntState(): StuntState {
  return { active: false, elapsed: 0, cooldown: 0, previousX: 0, previousZ: 0, initialized: false };
}
export type JumpRamp = Readonly<{ id: string; position: readonly [number, number];
  height: number; yaw: number; pitch: number; roll: number; forward: readonly [number, number] }>;
const FRACTIONS: Record<TrackId, readonly number[]> = {
  meadow: [.04, .55], harbor: [.12, .56, .78], canyon: [.18, .72], aurora: [.12, .4, .7],
};
/** Prefer gently bending runways so a normal racing line can land on the road. */
export function createJumpRamps(id: TrackId, route: readonly RaceRouteSample[]): JumpRamp[] {
  const chosen = new Set<number>();
  return FRACTIONS[id].map((fraction, index) => {
    let best = 0, score = Infinity;
    for (let i = 12; i < route.length - 20; i++) {
      if ([...chosen].some(previous => Math.min(Math.abs(previous - i), route.length - Math.abs(previous - i)) < 60)) continue;
      const point = route[i];
      if (Math.abs(point.raceProgress - fraction) > .18) continue;
      let bend = 0;
      for (let ahead = 0; ahead <= 20; ahead += 4) {
        const next = route[(i + ahead) % route.length];
        const dx = next.position[0] - point.position[0], dz = next.position[1] - point.position[1];
        bend = Math.max(bend, Math.abs(dx * point.normal[0] + dz * point.normal[1]));
      }
      const candidate = Math.abs(point.raceProgress - fraction) + bend * .08;
      if (candidate < score) { score = candidate; best = i; }
    }
    chosen.add(best);
    const point = route[best], yaw = Math.atan2(-point.tangent[0], -point.tangent[1]);
    const surface = sampleTrackSurface(...point.position, route);
    return { id: `jump-${index}`, position: point.position, height: surface.height,
      yaw, ...roadOrientation(yaw, surface), forward: point.tangent };
  });
}
function coordinates(x: number, z: number, ramp: JumpRamp) {
  const dx = x - ramp.position[0], dz = z - ramp.position[1];
  return { along: dx * ramp.forward[0] + dz * ramp.forward[1],
    across: -dx * ramp.forward[1] + dz * ramp.forward[0] };
}
export function applyRampSurface(x: number, z: number, ramps: readonly JumpRamp[], surface: ReturnType<typeof createSurfaceResult>) {
  for (const ramp of ramps) {
    const { along, across } = coordinates(x, z, ramp);
    if (along < -STUNT_CONFIG.length || along > 0 || Math.abs(across) > STUNT_CONFIG.width / 2) continue;
    surface.height += (1 + along / STUNT_CONFIG.length) * STUNT_CONFIG.rise;
    surface.gradientX += ramp.forward[0] * STUNT_CONFIG.rise / STUNT_CONFIG.length;
    surface.gradientZ += ramp.forward[1] * STUNT_CONFIG.rise / STUNT_CONFIG.length;
    break;
  }
  return surface;
}
/** Crossing the lip must be forward, grounded, fast enough and within the ramp. */
export function stepStuntLaunch(state: StuntState, x: number, y: number, z: number,
  yaw: number, speed: number, ramps: readonly JumpRamp[], enabled: boolean, dt: number) {
  const delta = Math.max(0, Math.min(dt, .05));
  state.cooldown = Math.max(0, state.cooldown - delta);
  if (state.active) state.elapsed += delta;
  let launched = false;
  if (enabled && state.initialized && !state.active && state.cooldown === 0 && speed >= STUNT_CONFIG.minimumSpeed) {
    for (const ramp of ramps) {
      const previous = coordinates(state.previousX, state.previousZ, ramp);
      const current = coordinates(x, z, ramp);
      const movement = current.along - previous.along;
      if (previous.along > 0 || current.along < 0 || movement <= 0 || movement > 2) continue;
      const amount = -previous.along / movement;
      const across = previous.across + (current.across - previous.across) * amount;
      const forwardDot = -Math.sin(yaw) * ramp.forward[0] - Math.cos(yaw) * ramp.forward[1];
      if (Math.abs(across) > STUNT_CONFIG.width / 2 || forwardDot < STUNT_CONFIG.minimumForwardDot ||
        Math.abs(y - ramp.height - STUNT_CONFIG.rise - KART_START.position[1]) > .6) continue;
      state.active = true; state.elapsed = 0; launched = true; break;
    }
  }
  state.previousX = x; state.previousZ = z; state.initialized = true;
  return launched;
}
export function finishStunt(state: StuntState, heightAboveRoad: number, verticalSpeed: number, roadDistance: number) {
  if (!state.active) return false;
  if (state.elapsed > STUNT_CONFIG.maximumAirSeconds) {
    state.active = false; state.elapsed = 0; state.cooldown = STUNT_CONFIG.cooldown;
    return false;
  }
  if (state.elapsed < .15 || verticalSpeed > 0 || heightAboveRoad > .15 || roadDistance > TRACK_CONFIG.roadWidth / 2) return false;
  state.active = false; state.elapsed = 0; state.cooldown = STUNT_CONFIG.cooldown;
  return true;
}
export function stuntProgress(state: StuntState) {
  return state.active ? Math.max(.001, Math.min(1, state.elapsed / STUNT_CONFIG.spinSeconds)) : 0;
}
export function applyStuntBoost(kart: KartSimulationState): KartSimulationState {
  return { ...kart, drift: { ...kart.drift, active: false, charge: 0, chargeTier: 0,
    turboTier: kart.drift.turboRemaining > STUNT_CONFIG.landingBoostSeconds && kart.drift.turboTier > 2 ? kart.drift.turboTier : 2, turboRemaining: Math.max(kart.drift.turboRemaining, STUNT_CONFIG.landingBoostSeconds) } };
}
