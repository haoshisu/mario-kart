import type { TrackCurve } from "./trackLayout";
import type { TrackSample } from "./trackPath";

/** Open ribbons never connect the exit back to the entry. Metre spacing keeps
 * the shortcut's colliders and server projection on the same authored curve. */
export function createOpenTrackSamples(curves: readonly TrackCurve[], from: TrackSample, to: TrackSample): readonly TrackSample[] {
  const dense: Array<readonly [number, number]> = [];
  for (const [a, b, c, d] of curves) {
    for (let step = 0; step < 100; step++) {
      const t = step / 100, u = 1 - t;
      dense.push([u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
        u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]]);
    }
  }
  dense.push(curves[curves.length - 1][3]);
  const distances = [0];
  for (let i = 1; i < dense.length; i++) distances.push(distances[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const length = distances[distances.length - 1], count = Math.ceil(length);
  const points: Array<readonly [number, number]> = [];
  let segment = 0;
  for (let i = 0; i <= count; i++) {
    const distance = length * i / count;
    while (segment < dense.length - 2 && distances[segment + 1] < distance) segment++;
    const t = (distance - distances[segment]) / (distances[segment + 1] - distances[segment]);
    const a = dense[segment], b = dense[segment + 1];
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return points.map((position, i) => {
    const previous = points[Math.max(0, i - 1)], next = points[Math.min(count, i + 1)];
    const dx = next[0] - previous[0], dz = next[1] - previous[1], distance = Math.hypot(dx, dz);
    const progress = i / count, blend = (1 - Math.cos(progress * Math.PI)) / 2;
    const tangent = i === 0 ? from.tangent : i === count ? to.tangent : [dx / distance, dz / distance] as const;
    return { position, tangent, normal: [-tangent[1], tangent[0]] as const, progress,
      height: from.height + (to.height - from.height) * blend,
      bank: from.bank + (to.bank - from.bank) * blend };
  });
}
