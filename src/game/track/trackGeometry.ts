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
  leftOffset: number,
  rightOffset: number,
  top: number,
  bottom: number,
): TrackMeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const sample of samples) {
    const left = pointAtTrackOffset(sample, leftOffset);
    const right = pointAtTrackOffset(sample, rightOffset);
    vertices.push(
      left[0], top + surfaceOffsetHeight(sample, leftOffset), left[1],
      right[0], top + surfaceOffsetHeight(sample, rightOffset), right[1],
      left[0], bottom + surfaceOffsetHeight(sample, leftOffset), left[1],
      right[0], bottom + surfaceOffsetHeight(sample, rightOffset), right[1],
    );
  }

  for (let index = 0; index < samples.length; index += 1) {
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
  const startFirst = pointAtTrackOffset(start, firstOffset);
  const startSecond = pointAtTrackOffset(start, secondOffset);
  const endFirst = pointAtTrackOffset(end, firstOffset);
  const endSecond = pointAtTrackOffset(end, secondOffset);
  const base = vertices.length / 3;

  vertices.push(
    startFirst[0], top + surfaceOffsetHeight(start, firstOffset), startFirst[1],
    startSecond[0], top + surfaceOffsetHeight(start, secondOffset), startSecond[1],
    endFirst[0], top + surfaceOffsetHeight(end, firstOffset), endFirst[1],
    endSecond[0], top + surfaceOffsetHeight(end, secondOffset), endSecond[1],
    startFirst[0], bottom + surfaceOffsetHeight(start, firstOffset), startFirst[1],
    startSecond[0], bottom + surfaceOffsetHeight(start, secondOffset), startSecond[1],
    endFirst[0], bottom + surfaceOffsetHeight(end, firstOffset), endFirst[1],
    endSecond[0], bottom + surfaceOffsetHeight(end, secondOffset), endSecond[1],
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
): TrackMeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const halfRoad = TRACK_CONFIG.roadWidth / 2;
  const outerCurb = halfRoad + TRACK_CONFIG.curbWidth;
  const top = TRACK_CONFIG.roadTop + TRACK_CONFIG.curbHeight;
  const bottom = TRACK_CONFIG.roadTop - TRACK_CONFIG.roadThickness / 2;

  for (let index = 0; index < samples.length; index += 1) {
    if (!includeSegment(index)) {
      continue;
    }

    const next = (index + 1) % samples.length;
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

function createGuardRailSegments(samples: readonly TrackSample[]): readonly GuardRailSegment[] {
  const segments: GuardRailSegment[] = [];
  const offset =
    TRACK_CONFIG.roadWidth / 2 +
    TRACK_CONFIG.curbWidth +
    TRACK_CONFIG.guardRail.gap;

  for (const side of [-1, 1] as const) {
    for (let index = 0; index < samples.length; index += 1) {
      const next = (index + 1) % samples.length;
      const start = pointAtTrackOffset(samples[index], offset * side);
      const end = pointAtTrackOffset(samples[next], offset * side);
      const deltaX = end[0] - start[0];
      const deltaZ = end[1] - start[1];

      segments.push({
        position: [
          (start[0] + end[0]) / 2,
          TRACK_CONFIG.guardRail.height / 2 + (surfaceOffsetHeight(samples[index], offset * side) + surfaceOffsetHeight(samples[next], offset * side)) / 2,
          (start[1] + end[1]) / 2,
        ],
        rotationY: -Math.atan2(deltaZ, deltaX),
        rotationZ: Math.atan2(surfaceOffsetHeight(samples[next], offset * side) - surfaceOffsetHeight(samples[index], offset * side), Math.hypot(deltaX, deltaZ)),
        size: [
          Math.hypot(deltaX, deltaZ, surfaceOffsetHeight(samples[next], offset * side) - surfaceOffsetHeight(samples[index], offset * side)) + 0.04,
          TRACK_CONFIG.guardRail.height,
          TRACK_CONFIG.guardRail.thickness,
        ],
        stripe: Math.floor(index / 3) % 2 === 0 ? "red" : "white",
      });
    }
  }

  return segments;
}

export function createTrackGeometry(samples: readonly TrackSample[]) {
  const halfDrivable = TRACK_CONFIG.roadWidth / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap;
  const DRIVABLE_MESH_DATA = createContinuousBand(samples, halfDrivable, -halfDrivable, TRACK_CONFIG.roadTop, TRACK_CONFIG.roadTop - TRACK_CONFIG.roadThickness);
  const ROAD_MESH_DATA = createContinuousBand(
    samples,
    TRACK_CONFIG.roadWidth / 2,
    -TRACK_CONFIG.roadWidth / 2,
    TRACK_CONFIG.roadTop,
    TRACK_CONFIG.roadTop - TRACK_CONFIG.roadThickness,
  );

  const RED_CURB_MESH_DATA = createCurbs(samples, (index) => index % 2 === 0);
  const WHITE_CURB_MESH_DATA = createCurbs(samples, (index) => index % 2 === 1);
  const CURB_COLLIDER_MESH_DATA = mergeMeshData(
    RED_CURB_MESH_DATA,
    WHITE_CURB_MESH_DATA,
  );
  const GUARD_RAIL_SEGMENTS = createGuardRailSegments(samples);

  const ROAD_EDGE_MESH_DATA = mergeMeshData(
    createContinuousBand(samples, TRACK_CONFIG.roadWidth / 2 - .12, TRACK_CONFIG.roadWidth / 2 - .24,
      TRACK_CONFIG.roadTop + .008, TRACK_CONFIG.roadTop + .006),
    createContinuousBand(samples, -TRACK_CONFIG.roadWidth / 2 + .24, -TRACK_CONFIG.roadWidth / 2 + .12,
      TRACK_CONFIG.roadTop + .008, TRACK_CONFIG.roadTop + .006),
  );

  return { DRIVABLE_MESH_DATA, ROAD_MESH_DATA, RED_CURB_MESH_DATA, WHITE_CURB_MESH_DATA, CURB_COLLIDER_MESH_DATA, GUARD_RAIL_SEGMENTS, ROAD_EDGE_MESH_DATA };
}
export const { DRIVABLE_MESH_DATA, ROAD_MESH_DATA, RED_CURB_MESH_DATA, WHITE_CURB_MESH_DATA, CURB_COLLIDER_MESH_DATA, GUARD_RAIL_SEGMENTS, ROAD_EDGE_MESH_DATA } = createTrackGeometry(TRACK_SAMPLES);
