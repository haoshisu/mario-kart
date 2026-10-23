import { surfaceOffsetHeight } from "./trackSurface";
import { TRACK_CONFIG } from "./trackConfig";
import {
  pointAtTrackOffset,
  TRACK_SAMPLES,
  type TrackSample,
} from "./trackPath";

export { TRACK_SAMPLES } from "./trackPath";
export type { TrackSample } from "./trackPath";

export type TrackMeshData = Readonly<{
  vertices: Float32Array;
  indices: Uint32Array;
}>;

export type GuardRailSegment = Readonly<{
  position: readonly [x: number, y: number, z: number];
  rotationY: number;
  rotationZ: number;
  size: readonly [length: number, height: number, thickness: number];
  stripe: "red" | "white";
}>;

export type RailOpening = Readonly<{ side: -1 | 1; from: number; to: number }>;
export type RoadRibbon = Readonly<{ samples: readonly TrackSample[]; width: number; closed?: boolean }>;
export type TrackGeometryOptions = Readonly<{ closed?: boolean; width?: number; railOpenings?: readonly RailOpening[]; avoidRoads?: readonly RoadRibbon[] }>;

function addQuad(
  indices: number[],
  first: number,
  second: number,
  third: number,
  fourth: number,
) {
  indices.push(first, second, third, second, fourth, third);
}

function createContinuousBand(
  samples: readonly TrackSample[],
  leftOffset: number | ((sample: TrackSample) => number),
  rightOffset: number | ((sample: TrackSample) => number),
  top: number,
  bottom: number,
  closed = true,
): TrackMeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const sample of samples) {
    const leftValue = typeof leftOffset === "number" ? leftOffset : leftOffset(sample);
    const rightValue = typeof rightOffset === "number" ? rightOffset : rightOffset(sample);
    const left = pointAtTrackOffset(sample, leftValue);
    const right = pointAtTrackOffset(sample, rightValue);
    vertices.push(
      left[0], top + surfaceOffsetHeight(sample, leftValue), left[1],
      right[0], top + surfaceOffsetHeight(sample, rightValue), right[1],
      left[0], bottom + surfaceOffsetHeight(sample, leftValue), left[1],
      right[0], bottom + surfaceOffsetHeight(sample, rightValue), right[1],
    );
  }

  for (let index = 0; index < samples.length - (closed ? 0 : 1); index += 1) {
    const next = (index + 1) % samples.length;
    const currentBase = index * 4;
    const nextBase = next * 4;

    addQuad(indices, currentBase, nextBase, currentBase + 1, nextBase + 1);
    addQuad(indices, currentBase + 2, currentBase + 3, nextBase + 2, nextBase + 3);
    addQuad(indices, currentBase, currentBase + 2, nextBase, nextBase + 2);
    addQuad(indices, currentBase + 1, nextBase + 1, currentBase + 3, nextBase + 3);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

function addBandPrism(
  vertices: number[],
  indices: number[],
  start: TrackSample,
  end: TrackSample,
  firstOffset: number,
  secondOffset: number,
  top: number,
  bottom: number,
) {
  const endAdjustment = ((end.width ?? TRACK_CONFIG.roadWidth) - (start.width ?? TRACK_CONFIG.roadWidth)) / 2;
  const endFirstOffset = firstOffset + Math.sign(firstOffset) * endAdjustment;
  const endSecondOffset = secondOffset + Math.sign(secondOffset) * endAdjustment;
  const startFirst = pointAtTrackOffset(start, firstOffset);
  const startSecond = pointAtTrackOffset(start, secondOffset);
  const endFirst = pointAtTrackOffset(end, endFirstOffset);
  const endSecond = pointAtTrackOffset(end, endSecondOffset);
  const base = vertices.length / 3;

  vertices.push(
    startFirst[0], top + surfaceOffsetHeight(start, firstOffset), startFirst[1],
    startSecond[0], top + surfaceOffsetHeight(start, secondOffset), startSecond[1],
    endFirst[0], top + surfaceOffsetHeight(end, endFirstOffset), endFirst[1],
    endSecond[0], top + surfaceOffsetHeight(end, endSecondOffset), endSecond[1],
    startFirst[0], bottom + surfaceOffsetHeight(start, firstOffset), startFirst[1],
    startSecond[0], bottom + surfaceOffsetHeight(start, secondOffset), startSecond[1],
    endFirst[0], bottom + surfaceOffsetHeight(end, endFirstOffset), endFirst[1],
    endSecond[0], bottom + surfaceOffsetHeight(end, endSecondOffset), endSecond[1],
  );

  addQuad(indices, base, base + 1, base + 2, base + 3);
  addQuad(indices, base + 4, base + 6, base + 5, base + 7);
  addQuad(indices, base, base + 2, base + 4, base + 6);
  addQuad(indices, base + 1, base + 5, base + 3, base + 7);
  addQuad(indices, base, base + 4, base + 1, base + 5);
  addQuad(indices, base + 2, base + 3, base + 6, base + 7);
}

function createCurbs(
  samples: readonly TrackSample[],
  includeSegment: (index: number) => boolean,
  width: number,
  closed: boolean,
): TrackMeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const top = TRACK_CONFIG.roadTop + TRACK_CONFIG.curbHeight;
  const bottom = TRACK_CONFIG.roadTop - TRACK_CONFIG.roadThickness / 2;

  for (let index = 0; index < samples.length - (closed ? 0 : 1); index += 1) {
    if (!includeSegment(index)) {
      continue;
    }

    const next = (index + 1) % samples.length;
    const halfRoad = (samples[index].width ?? width) / 2;
    const outerCurb = halfRoad + TRACK_CONFIG.curbWidth;
    addBandPrism(
      vertices,
      indices,
      samples[index],
      samples[next],
      halfRoad,
      outerCurb,
      top,
      bottom,
    );
    addBandPrism(
      vertices,
      indices,
      samples[index],
      samples[next],
      -outerCurb,
      -halfRoad,
      top,
      bottom,
    );
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

function mergeMeshData(...meshes: readonly TrackMeshData[]): TrackMeshData {
  const vertexLength = meshes.reduce((total, mesh) => total + mesh.vertices.length, 0);
  const indexLength = meshes.reduce((total, mesh) => total + mesh.indices.length, 0);
  const vertices = new Float32Array(vertexLength);
  const indices = new Uint32Array(indexLength);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const mesh of meshes) {
    vertices.set(mesh.vertices, vertexOffset);
    const pointOffset = vertexOffset / 3;
    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index] + pointOffset;
    }
    vertexOffset += mesh.vertices.length;
    indexOffset += mesh.indices.length;
  }

  return { vertices, indices };
}

function createGuardRailSegments(samples: readonly TrackSample[], width: number, closed: boolean, openings: readonly RailOpening[]): readonly GuardRailSegment[] {
  const segments: GuardRailSegment[] = [];

  for (const side of [-1, 1] as const) {
    for (let index = 0; index < samples.length - (closed ? 0 : 1); index += 1) {
      if (openings.some(opening => opening.side === side && samples[index].progress >= opening.from && samples[index].progress <= opening.to)) continue;
      const next = (index + 1) % samples.length;
      const startOffset = (samples[index].width ?? width) / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap;
      const endOffset = (samples[next].width ?? width) / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap;
      const start = pointAtTrackOffset(samples[index], startOffset * side);
      const end = pointAtTrackOffset(samples[next], endOffset * side);
      const deltaX = end[0] - start[0];
      const deltaZ = end[1] - start[1];

      segments.push({
        position: [
          (start[0] + end[0]) / 2,
          TRACK_CONFIG.guardRail.height / 2 + (surfaceOffsetHeight(samples[index], startOffset * side) + surfaceOffsetHeight(samples[next], endOffset * side)) / 2,
          (start[1] + end[1]) / 2,
        ],
        rotationY: -Math.atan2(deltaZ, deltaX),
        rotationZ: Math.atan2(surfaceOffsetHeight(samples[next], endOffset * side) - surfaceOffsetHeight(samples[index], startOffset * side), Math.hypot(deltaX, deltaZ)),
        size: [
          Math.hypot(deltaX, deltaZ, surfaceOffsetHeight(samples[next], endOffset * side) - surfaceOffsetHeight(samples[index], startOffset * side)) + 0.04,
          TRACK_CONFIG.guardRail.height,
          TRACK_CONFIG.guardRail.thickness,
        ],
        stripe: Math.floor(index / 3) % 2 === 0 ? "red" : "white",
      });
    }
  }

  return segments;
}

/** Test the whole rail prism against each road segment, rather than choosing
 * one nearest surface. At junctions several ribbons can share the same XZ. */
export function railObstructsRoad(rail: GuardRailSegment, ribbon: RoadRibbon) {
  const half = rail.size[0] / 2;

  for (const along of [-half, 0, half]) {
    const x = rail.position[0] + Math.cos(rail.rotationY) * Math.cos(rail.rotationZ) * along;
    const z = rail.position[2] - Math.sin(rail.rotationY) * Math.cos(rail.rotationZ) * along;
    const railRoadHeight = rail.position[1] + Math.sin(rail.rotationZ) * along - TRACK_CONFIG.guardRail.height / 2;
    for (let i = 0; i < ribbon.samples.length - (ribbon.closed === false ? 1 : 0); i++) {
      const a = ribbon.samples[i], b = ribbon.samples[(i + 1) % ribbon.samples.length];
      const dx = b.position[0] - a.position[0], dz = b.position[1] - a.position[1];
      const length2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a.position[0]) * dx + (z - a.position[1]) * dz) / length2));
      const px = x - a.position[0] - dx * t, pz = z - a.position[1] - dz * t;
      const lateralClearance = ((a.width ?? ribbon.width) + ((b.width ?? ribbon.width) - (a.width ?? ribbon.width)) * t) / 2 + TRACK_CONFIG.curbWidth + .8;
      if (px * px + pz * pz > lateralClearance * lateralClearance) continue;
      const length = Math.sqrt(length2);
      const height = a.height + (b.height - a.height) * t
        + (-dz * px + dx * pz) / length * Math.tan(a.bank + (b.bank - a.bank) * t);
      if (Math.abs(height - railRoadHeight) < 2) return true;
    }
  }
  return false;
}

export function createTrackGeometry(samples: readonly TrackSample[], options: TrackGeometryOptions = {}) {
  const { closed = true, width = TRACK_CONFIG.roadWidth, railOpenings = [], avoidRoads = [] } = options;
  const halfWidth = (sample: TrackSample) => (sample.width ?? width) / 2;
  const halfDrivable = (sample: TrackSample) => halfWidth(sample) + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap;
  const DRIVABLE_MESH_DATA = createContinuousBand(samples, halfDrivable, sample => -halfDrivable(sample), TRACK_CONFIG.roadTop, TRACK_CONFIG.roadTop - TRACK_CONFIG.roadThickness, closed);
  const ROAD_MESH_DATA = createContinuousBand(
    samples,
    halfWidth,
    sample => -halfWidth(sample),
    TRACK_CONFIG.roadTop,
    TRACK_CONFIG.roadTop - TRACK_CONFIG.roadThickness, closed,
  );

  const RED_CURB_MESH_DATA = createCurbs(samples, (index) => index % 2 === 0, width, closed);
  const WHITE_CURB_MESH_DATA = createCurbs(samples, (index) => index % 2 === 1, width, closed);
  const CURB_COLLIDER_MESH_DATA = mergeMeshData(
    RED_CURB_MESH_DATA,
    WHITE_CURB_MESH_DATA,
  );
  const GUARD_RAIL_SEGMENTS = createGuardRailSegments(samples, width, closed, railOpenings)
    .filter(rail => !avoidRoads.some(ribbon => railObstructsRoad(rail, ribbon)));

  const ROAD_EDGE_MESH_DATA = mergeMeshData(
    createContinuousBand(samples, sample => halfWidth(sample) - .12, sample => halfWidth(sample) - .24,
      TRACK_CONFIG.roadTop + .008, TRACK_CONFIG.roadTop + .006, closed),
    createContinuousBand(samples, sample => -halfWidth(sample) + .24, sample => -halfWidth(sample) + .12,
      TRACK_CONFIG.roadTop + .008, TRACK_CONFIG.roadTop + .006, closed),
  );

  return { DRIVABLE_MESH_DATA, ROAD_MESH_DATA, RED_CURB_MESH_DATA, WHITE_CURB_MESH_DATA, CURB_COLLIDER_MESH_DATA, GUARD_RAIL_SEGMENTS, ROAD_EDGE_MESH_DATA };
}
export const { DRIVABLE_MESH_DATA, ROAD_MESH_DATA, RED_CURB_MESH_DATA, WHITE_CURB_MESH_DATA, CURB_COLLIDER_MESH_DATA, GUARD_RAIL_SEGMENTS, ROAD_EDGE_MESH_DATA } = createTrackGeometry(TRACK_SAMPLES);
