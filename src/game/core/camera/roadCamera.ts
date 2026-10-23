import { advanceSpring } from "../motion/dampedSpring";
import { sampleDrivingSurface } from "../../track/drivingSurface";
import { createSurfaceResult, sampleTrackSurface } from "../../track/trackSurface";
import type { TrackData } from "../../track/trackData";
import type { TrackMeshData } from "../../track/trackGeometry";

type Point = { x: number; y: number; z: number };
const ROAD_FRAMING = { anchorHeight: .55, screenHeight: .69, response: 20 } as const;

/** Keep the driver above the controls after the road lifts the camera boom.
 * Adjust only look pitch: road clearance, boom distance and forward view stay
 * owned by the road constraint. An emergency orbit already centres the kart. */
export function frameRoadCamera(position: Point, target: Point, kart: Point, verticalFov: number,
  state: ReturnType<typeof createRoadCameraState>, delta = 1 / 60) {
  if (state.orbiting) { state.framingInitialized = false; return; }
  const dx = target.x - position.x, dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < .01) return;
  const along = ((kart.x - position.x) * dx + (kart.z - position.z) * dz) / distance;
  if (along < .1) return;
  const anchorPitch = Math.atan2(kart.y + ROAD_FRAMING.anchorHeight - position.y, along);
  const screenPitch = Math.atan((ROAD_FRAMING.screenHeight - .5) * 2 * Math.tan(verticalFov * Math.PI / 360));
  const reset = !state.framingInitialized || state.framingRevision !== state.revision || delta > .25;
  advanceSpring(state.framingPitch, anchorPitch + screenPitch, ROAD_FRAMING.response,
    Math.max(0, Math.min(delta, .1)), reset);
  target.y = position.y + distance * Math.tan(state.framingPitch.value);
  state.framingInitialized = true;
  state.framingRevision = state.revision;
}

export function createRoadCameraState() { return {
  surface: createSurfaceResult(), focus: { x: 0, y: 0, z: 0 }, visibilityFocus: { x: 0, y: 0, z: 0 }, candidate: { x: 0, y: 0, z: 0 },
  options: { height: 0, closed: true }, offset: { x: 0, y: 0, z: 0 },
  targetOffset: { x: 0, y: 0, z: 0 }, targetHeight: { value: 0, velocity: 0 }, initialized: false, revision: -1,
  orbiting: false, clearTime: 0, kartX: 0, kartZ: 0, kartHeight: 0, gradientX: 0, gradientZ: 0,
  framingPitch: { value: 0, velocity: 0 }, framingInitialized: false, framingRevision: -1,
}; }

function sampleCameraRoad(point: Point, samples: TrackData["samples"], state: ReturnType<typeof createRoadCameraState>) {
  state.options.height = state.kartHeight + (point.x - state.kartX) * state.gradientX + (point.z - state.kartZ) * state.gradientZ;
  return sampleTrackSurface(point.x, point.z, samples, state.surface, state.options);
}

/** Segment/triangle intersections include deck sides and undersides, so a
 * camera below an overpass never gets pushed onto the higher road. */
function firstRoadHit(from: Point, to: Point, mesh: TrackMeshData, closest: number) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const v = mesh.vertices, indices = mesh.indices;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const e1x = v[b] - v[a], e1y = v[b + 1] - v[a + 1], e1z = v[b + 2] - v[a + 2];
    const e2x = v[c] - v[a], e2y = v[c + 1] - v[a + 1], e2z = v[c + 2] - v[a + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const determinant = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(determinant) < 1e-8) continue;
    const tx = from.x - v[a], ty = from.y - v[a + 1], tz = from.z - v[a + 2];
    const u = (tx * px + ty * py + tz * pz) / determinant;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const w = (dx * qx + dy * qy + dz * qz) / determinant;
    if (w < 0 || u + w > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) / determinant;
    if (t > .001 && t < closest) closest = t;
  }
  return closest;
}

const ORBIT_ANGLES = [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI, 2 * Math.PI / 3, -2 * Math.PI / 3];
const ORBIT_HEIGHTS = [.9, 1.4, 2, .6];
const ORBIT_DISTANCES = [5, 4, 3.25];

export function roadCameraHasClearView(position: Point, focus: Point, track: TrackData) {
  let hit = firstRoadHit(focus, position, track.geometry.DRIVABLE_MESH_DATA, 1);
  for (const road of track.branches) hit = firstRoadHit(focus, position, road.geometry.DRIVABLE_MESH_DATA, hit);
  return hit === 1;
}

function cameraHasClearKartView(position: Point, track: TrackData, state: ReturnType<typeof createRoadCameraState>) {
  return roadCameraHasClearView(position, state.focus, track) &&
    roadCameraHasClearView(position, state.visibilityFocus, track);
}

export function constrainRoadCamera(position: Point, target: Point, kart: Point, track: TrackData,
  state: ReturnType<typeof createRoadCameraState>, delta = 1 / 60, revision = 0) {
  const reset = !state.initialized || state.revision !== revision || delta > .25;
  const dt = Math.max(0, Math.min(delta, .1));
  const surface = sampleDrivingSurface(kart.x, kart.z, track, state.surface, kart.y - .52);
  const branch = track.branches[(surface.routeIndex ?? 0) - 1];
  const samples = branch?.samples ?? track.samples;
  const options = state.options;
  options.closed = !branch;
  state.kartX = kart.x; state.kartZ = kart.z; state.kartHeight = surface.height;
  state.gradientX = surface.gradientX; state.gradientZ = surface.gradientZ;
  sampleCameraRoad(position, samples, state);
  if (surface.distance < 7) position.y = Math.max(position.y, surface.height + .85);
  sampleCameraRoad(target, samples, state);
  if (surface.distance < 7) target.y = surface.height + 1.1;
  // Filter grade changes as a kart-relative look offset, rather than chasing
  // world height and making the kart bob in the frame on a sustained slope.
  advanceSpring(state.targetHeight, target.y - kart.y, 12, dt, reset);
  target.y = kart.y + state.targetHeight.value;

  state.focus.x = kart.x; state.focus.y = kart.y + .55; state.focus.z = kart.z;
  // Test the chassis too: a clear ray to the driver's head alone can
  // leave the body hidden behind the crest of a steep bridge.
  state.visibilityFocus.x = kart.x; state.visibilityFocus.y = kart.y + .1; state.visibilityFocus.z = kart.z;
  const clear = cameraHasClearKartView(position, track, state);
  state.clearTime = clear ? state.clearTime + dt : 0;
  if (!clear || (state.orbiting && state.clearTime < .35 && !reset)) {
    const dx = position.x - kart.x, dz = position.z - kart.z;
    const distance = Math.hypot(dx, dz);
    const backX = distance > .01 ? dx / distance : 1, backZ = distance > .01 ? dz / distance : 0;
    const candidate = state.candidate;
    let found = false;
    let bestScore = Infinity;
    let bestX = 0, bestY = 0, bestZ = 0;
    // First retain the previous relative boom while it is still safe. This
    // prevents tiny triangle-boundary changes from selecting opposite orbits.
    if (!reset) {
      candidate.x = kart.x + state.offset.x;
      candidate.y = kart.y + state.offset.y;
      candidate.z = kart.z + state.offset.z;
      sampleCameraRoad(candidate, samples, state);
      if (surface.distance < 7) candidate.y = Math.max(candidate.y, surface.height + .85);
      if (cameraHasClearKartView(candidate, track, state)) {
        bestScore = 0; bestX = candidate.x; bestY = candidate.y; bestZ = candidate.z; found = true;
      }
    }
    // A small local move is preferable to jumping between widely separated
    // preset orbits when the boom grazes a sloping deck edge.
    if (!reset && !found) {
      for (const radius of [.25, .5, 1]) {
        for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) for (let iz = -1; iz <= 1; iz++) {
          if (ix === 0 && iy === 0 && iz === 0) continue;
          candidate.x = kart.x + state.offset.x + ix * radius;
          candidate.y = kart.y + state.offset.y + iy * radius;
          candidate.z = kart.z + state.offset.z + iz * radius;
          if (Math.hypot(candidate.x - kart.x, candidate.z - kart.z) < 3.25) continue;
          sampleCameraRoad(candidate, samples, state);
          if (surface.distance < 7) candidate.y = Math.max(candidate.y, surface.height + .85);
          if (!cameraHasClearKartView(candidate, track, state)) continue;
          const score = (candidate.x - kart.x - state.offset.x) ** 2 +
            (candidate.y - kart.y - state.offset.y) ** 2 + (candidate.z - kart.z - state.offset.z) ** 2;
          if (score < bestScore) { bestScore = score; bestX = candidate.x; bestY = candidate.y; bestZ = candidate.z; found = true; }
        }
        if (found) break;
      }
    }
    // Orbit before pulling in: the fox driver must remain outside the lens,
    // even when two roads converge with too little room for the usual boom.
    for (const boom of ORBIT_DISTANCES) {
      if (found) break;
      for (const height of ORBIT_HEIGHTS) {
        if (found) break;
        for (const angle of ORBIT_ANGLES) {
          const cosine = Math.cos(angle), sine = Math.sin(angle);
          candidate.x = kart.x + (backX * cosine - backZ * sine) * boom;
          candidate.z = kart.z + (backX * sine + backZ * cosine) * boom;
          candidate.y = kart.y + height;
          sampleCameraRoad(candidate, samples, state);
          if (surface.distance < 7) candidate.y = Math.max(candidate.y, surface.height + .85);
          if (!cameraHasClearKartView(candidate, track, state)) continue;
          const score = reset ? boom === 5 ? height * .01 + Math.abs(angle) : 10 + Math.abs(angle) :
            (candidate.x - kart.x - state.offset.x) ** 2 +
            (candidate.y - kart.y - state.offset.y) ** 2 +
            (candidate.z - kart.z - state.offset.z) ** 2;
          if (score < bestScore) {
            bestScore = score; bestX = candidate.x; bestY = candidate.y; bestZ = candidate.z; found = true;
          }
        }
      }
    }
    if (found) { position.x = bestX; position.y = bestY; position.z = bestZ; }
    if (!found) {
      // A pathological enclosed point still gets an exterior camera. Never
      // substitute a sub-metre boom that puts the lens inside the character.
      position.x = kart.x + backX * 3.25;
      position.z = kart.z + backZ * 3.25;
      sampleCameraRoad(position, samples, state);
      position.y = Math.max(kart.y + .6, surface.height + .85);
    }
    target.x = state.focus.x; target.y = state.focus.y; target.z = state.focus.z;
    state.orbiting = true;
  } else state.orbiting = false;
  if (!reset) {
    const blend = 1 - Math.exp(-8 * dt);
    const candidate = state.candidate;
    candidate.x = kart.x + state.offset.x + (position.x - kart.x - state.offset.x) * blend;
    candidate.y = kart.y + state.offset.y + (position.y - kart.y - state.offset.y) * blend;
    candidate.z = kart.z + state.offset.z + (position.z - kart.z - state.offset.z) * blend;
    sampleCameraRoad(candidate, samples, state);
    if (surface.distance < 7) candidate.y = Math.max(candidate.y, surface.height + .85);
    if (cameraHasClearKartView(candidate, track, state)) {
      position.x = candidate.x; position.y = candidate.y; position.z = candidate.z;
    }
  }
  if (!reset) {
    const blend = 1 - Math.exp(-10 * dt);
    target.x = kart.x + state.targetOffset.x + (target.x - kart.x - state.targetOffset.x) * blend;
    target.y = kart.y + state.targetOffset.y + (target.y - kart.y - state.targetOffset.y) * blend;
    target.z = kart.z + state.targetOffset.z + (target.z - kart.z - state.targetOffset.z) * blend;
  }
  state.targetOffset.x = target.x - kart.x; state.targetOffset.y = target.y - kart.y; state.targetOffset.z = target.z - kart.z;
  state.offset.x = position.x - kart.x; state.offset.y = position.y - kart.y; state.offset.z = position.z - kart.z;
  state.initialized = true; state.revision = revision;
}
