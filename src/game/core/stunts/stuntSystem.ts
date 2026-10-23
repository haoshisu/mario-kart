import { MEADOW_PARK_BIG_JUMP } from "../../track/meadowPark";
import { PARK_BIG_JUMP_SPEED } from "../../track/themeParks";
import { KART_START } from "../kart/kartConfig";
import { TRACK_CONFIG } from "../../track/trackConfig";
import type { KartSimulationState } from "../kart/kartTypes";
import type { RaceRouteSample } from "../race/raceTrack";
import type { TrackId } from "../../track/trackCatalog";
import { circularDistance, evaluateJumpRunway, routeLength } from "../../track/trackPlacement";
import { roadOrientation, sampleTrackSurface, type createSurfaceResult } from "../../track/trackSurface";

export const STUNT_CONFIG = { length: 4, width: 3.4, rise: .8, launchSpeed: 5.5,
  minimumSpeed: 6, minimumForwardDot: .7, airSteering: .45, cooldown: 2, spinSeconds: .85,
  landingBoostSeconds: .8, maximumAirSeconds: 4, trickBufferSeconds: .14, trickWindowSeconds: .22 } as const;
export type StuntState = { active: boolean; elapsed: number; cooldown: number;
  previousX: number; previousZ: number; initialized: boolean; launchSpeed: number;
  timed: boolean; previousDrift: boolean; bufferedTrick: number; trickSucceeded: boolean; trickAt: number };
export function createStuntState(timed = false): StuntState {
  return { active: false, elapsed: 0, cooldown: 0, previousX: 0, previousZ: 0, initialized: false, launchSpeed: STUNT_CONFIG.launchSpeed,
    timed, previousDrift: false, bufferedTrick: 0, trickSucceeded: false, trickAt: 0 };
}
/** A fresh tap around the lip earns the trick; holding drift in advance does not. */
export function updateStuntTrick(state: StuntState, pressed: boolean, enabled: boolean, dt: number) {
  state.bufferedTrick = Math.max(0, state.bufferedTrick - Math.min(.05, Math.max(0, dt)));
  const tapped = enabled && pressed && !state.previousDrift;
  state.previousDrift = pressed;
  if (!enabled) { state.bufferedTrick = 0; return; }
  if (tapped && !state.active) state.bufferedTrick = STUNT_CONFIG.trickBufferSeconds;
  if (tapped && state.active && state.elapsed <= STUNT_CONFIG.trickWindowSeconds && !state.trickSucceeded) {
    state.trickSucceeded = true; state.trickAt = state.elapsed;
  }
}
export type JumpRamp = Readonly<{ id: string; position: readonly [number, number];
  height: number; launchSpeed?: number; yaw: number; pitch: number; roll: number; forward: readonly [number, number] }>;
const FRACTIONS: Record<TrackId, readonly number[]> = {
  tainan: [.70], taichung: [.35],
  taipei: [.57], jiufen: [.59], kaohsiung: [.61], alishan: [.70],
  forest: [.13], clockwork: [.13], volcano: [.13],
  meadow: [MEADOW_PARK_BIG_JUMP.fraction, .91], harbor: [.35, .55, .75], canyon: [.14, .81], aurora: [.12, .51, .7],
};
/** Side ramps leave a broad ground lane; placement fails loudly if authored road
 * lacks a safe landing rather than silently putting an unsafe ramp at the grid.
 */
export function createJumpRamps(id: TrackId, route: readonly RaceRouteSample[]): JumpRamp[] {
  const length = routeLength(route);
  const candidates = FRACTIONS[id].map((fraction, index) => route.flatMap(point => {
    if (point.raceProgress < .12 || point.raceProgress > .93 || Math.abs(point.raceProgress - fraction) > .12) return [];
    const lane = (index % 2 ? -2 : 2) * (id === "meadow" ? -1 : 1);
    const launchSpeed = index === 0 ? PARK_BIG_JUMP_SPEED : STUNT_CONFIG.launchSpeed;
    const runway = evaluateJumpRunway(route, point, lane, STUNT_CONFIG.rise, launchSpeed);
    return runway ? [{ point, lane, runway, launchSpeed, score: Math.abs(point.raceProgress - fraction) }] : [];
  }).sort((a, b) => a.score - b.score));
  type Candidate = typeof candidates[number][number];
  function choose(index: number, selected: Candidate[]): Candidate[] | undefined {
    if (index === candidates.length) return selected;
    for (const candidate of candidates[index]) {
      if (selected.some(other => circularDistance(other.point.distance, candidate.point.distance, length) <
        23 * (Math.max(other.runway.maximumFlightSeconds, candidate.runway.maximumFlightSeconds) + STUNT_CONFIG.cooldown))) continue;
      const result = choose(index + 1, [...selected, candidate]);
      if (result) return result;
    }
    return undefined;
  }
  const selected = choose(0, []);
  if (!selected) throw new Error(`${id}: no safe, cooldown-separated jump runways in the authored placement bands`);
  return selected.map(({ point, lane, launchSpeed }, index) => {
    const position = [point.position[0] + point.normal[0] * lane, point.position[1] + point.normal[1] * lane] as const;
    const yaw = Math.atan2(-point.tangent[0], -point.tangent[1]);
    const surface = sampleTrackSurface(...position, route, undefined, { height: point.height });
    return { id: `jump-${index}`, position, launchSpeed, height: surface.height,
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
    if (Math.abs(surface.height - ramp.height) > 2) continue;
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
      state.active = true; state.elapsed = 0; state.launchSpeed = ramp.launchSpeed ?? STUNT_CONFIG.launchSpeed;
      state.trickSucceeded = !state.timed || state.bufferedTrick > 0; state.trickAt = 0; state.bufferedTrick = 0;
      launched = true; break;
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
  // The nonzero sentinel retains airborne steering without an automatic flip.
  return state.active ? state.trickSucceeded ? Math.max(.001, Math.min(1, (state.elapsed - state.trickAt) / STUNT_CONFIG.spinSeconds)) : .001 : 0;
}
export function applyStuntBoost(kart: KartSimulationState): KartSimulationState {
  return { ...kart, drift: { ...kart.drift, active: false, direction: 0, charge: 0, chargeTier: 0,
    turboTier: kart.drift.turboRemaining > STUNT_CONFIG.landingBoostSeconds && kart.drift.turboTier > 2 ? kart.drift.turboTier : 2, turboRemaining: Math.max(kart.drift.turboRemaining, STUNT_CONFIG.landingBoostSeconds) } };
}
