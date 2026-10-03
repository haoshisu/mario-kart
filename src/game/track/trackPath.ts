import { elevationAt, VALLEY_ELEVATION, type ElevationKey } from "./trackSurface";
import { TRACK_CURVES, TRACK_LAYOUT, type TrackCurve } from "./trackLayout";

export type TrackSample = Readonly<{
  position: readonly [x: number, z: number];
  tangent: readonly [x: number, z: number];
  normal: readonly [x: number, z: number];
  progress: number;
  height: number;
  bank: number;
}>;

// Flatten authored Beziers, then resample by arc length. Equal metre spacing
// keeps AI look-ahead, curb stripes and checkpoint placement consistent.
export function createTrackSamples(curves: readonly TrackCurve[] = TRACK_CURVES, elevation: readonly ElevationKey[] = VALLEY_ELEVATION): readonly TrackSample[] {
  const dense: Array<readonly [number, number]> = [];
  for (const [a, b, c, d] of curves) {
    for (let step = 0; step < 100; step += 1) {
      const t = step / 100, u = 1 - t;
      dense.push([
        u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
        u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1],
      ]);
    }
  }
  const distances = [0];
  for (let i = 0; i < dense.length; i += 1) {
    const next = dense[(i + 1) % dense.length];
    distances.push(distances[i] + Math.hypot(next[0] - dense[i][0], next[1] - dense[i][1]));
  }
  const length = distances[dense.length];
  const count = Math.ceil(length / TRACK_LAYOUT.sampleSpacing);
  const points: Array<readonly [number, number]> = [];
  let segment = 0;
  for (let i = 0; i < count; i += 1) {
    const distance = i * length / count;
    while (segment < dense.length - 1 && distances[segment + 1] < distance) segment += 1;
    const t = (distance - distances[segment]) / (distances[segment + 1] - distances[segment]);
    const a = dense[segment], b = dense[(segment + 1) % dense.length];
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }

  return points.map((position, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const tangentX = next[0] - previous[0];
    const tangentZ = next[1] - previous[1];
    const length = Math.hypot(tangentX, tangentZ);
    const tangent = [tangentX / length, tangentZ / length] as const;

    return {
      position,
      height: elevationAt(index / points.length, elevation),
      bank: index / points.length < .1 || index / points.length > .92 ? 0
        : Math.sin((index / points.length - .1) / .82 * Math.PI) ** 2 * Math.sin(index / points.length * 4 * Math.PI) * .08,
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

/** Scenery clearance uses the same centreline as collision and racing. */
export function distanceToTrack(x: number, z: number, samples = TRACK_SAMPLES) {
  let nearest = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const a = samples[i].position;
    const b = samples[(i + 1) % samples.length].position;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  return nearest;
}
