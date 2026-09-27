import { TRACK_CONFIG } from "./trackConfig";

export type TrackSample = Readonly<{
  position: readonly [x: number, z: number];
  tangent: readonly [x: number, z: number];
  normal: readonly [x: number, z: number];
  progress: number;
}>;

function addStraightSamples(
  samples: Array<readonly [number, number]>,
  fromX: number,
  toX: number,
  z: number,
  segmentCount: number,
) {
  for (let index = 0; index < segmentCount; index += 1) {
    const progress = index / segmentCount;
    samples.push([fromX + (toX - fromX) * progress, z]);
  }
}

function addTurnSamples(
  samples: Array<readonly [number, number]>,
  centerX: number,
  startAngle: number,
  segmentCount: number,
) {
  for (let index = 0; index < segmentCount; index += 1) {
    const angle = startAngle + (Math.PI * index) / segmentCount;
    samples.push([
      centerX + Math.cos(angle) * TRACK_CONFIG.turnRadius,
      Math.sin(angle) * TRACK_CONFIG.turnRadius,
    ]);
  }
}

function createTrackSamples(): readonly TrackSample[] {
  const points: Array<readonly [number, number]> = [];
  const halfStraight = TRACK_CONFIG.straightLength / 2;

  addStraightSamples(
    points,
    -halfStraight,
    halfStraight,
    -TRACK_CONFIG.turnRadius,
    TRACK_CONFIG.straightSegments,
  );
  addTurnSamples(points, halfStraight, -Math.PI / 2, TRACK_CONFIG.curveSegments);
  addStraightSamples(
    points,
    halfStraight,
    -halfStraight,
    TRACK_CONFIG.turnRadius,
    TRACK_CONFIG.straightSegments,
  );
  addTurnSamples(points, -halfStraight, Math.PI / 2, TRACK_CONFIG.curveSegments);

  return points.map((position, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const tangentX = next[0] - previous[0];
    const tangentZ = next[1] - previous[1];
    const length = Math.hypot(tangentX, tangentZ);
    const tangent = [tangentX / length, tangentZ / length] as const;

    return {
      position,
      tangent,
      normal: [-tangent[1], tangent[0]] as const,
      progress: index / points.length,
    };
  });
}

export function pointAtTrackOffset(sample: TrackSample, offset: number) {
  return [
    sample.position[0] + sample.normal[0] * offset,
    sample.position[1] + sample.normal[1] * offset,
  ] as const;
}

export const TRACK_SAMPLES = createTrackSamples();
