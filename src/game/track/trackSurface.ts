import type { TrackSample } from "./trackPath";

export type ElevationKey = readonly [fraction: number, height: number];
export const VALLEY_ELEVATION: readonly ElevationKey[] = [[0,0],[.1,0],[.28,4.8],[.42,4.8],[.62,.5],[.76,3],[.92,0],[1,0]];
export function elevationAt(fraction: number, keys: readonly ElevationKey[]) {
  for (let i = 1; i < keys.length; i += 1) {
    if (fraction > keys[i][0]) continue;
    const [from, height] = keys[i - 1], [to, next] = keys[i];
    const t = (fraction - from) / (to - from);
    return height + (next - height) * (1 - Math.cos(t * Math.PI)) / 2;
  }
  return 0;
}
export function surfaceOffsetHeight(sample: TrackSample, offset: number) {
  return sample.height + Math.tan(sample.bank) * offset;
}
export function createSurfaceResult() { return { height: 0, gradientX: 0, gradientZ: 0, distance: Infinity }; }
/** Shared road constraint for Arcade physics and presentation, including banking.
 * Query projects onto the same one-metre segments used by the road mesh.
 */
export function sampleTrackSurface(x: number, z: number, samples: readonly TrackSample[], out = createSurfaceResult()) {
  let best = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const a = samples[i], b = samples[(i + 1) % samples.length];
    const dx = b.position[0] - a.position[0], dz = b.position[1] - a.position[1];
    const length2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.position[0]) * dx + (z - a.position[1]) * dz) / length2));
    const px = x - a.position[0] - dx * t, pz = z - a.position[1] - dz * t;
    const distance2 = px * px + pz * pz;
    if (distance2 >= best) continue;
    best = distance2;
    const length = Math.sqrt(length2), tx = dx / length, tz = dz / length;
    const bank = Math.tan(a.bank + (b.bank - a.bank) * t);
    const grade = (b.height - a.height) / length;
    out.height = a.height + (b.height - a.height) * t + (-tz * px + tx * pz) * bank;
    out.gradientX = tx * grade - tz * bank;
    out.gradientZ = tz * grade + tx * bank;
  }
  out.distance = Math.sqrt(best);
  return out;
}
export function roadOrientation(yaw: number, surface: ReturnType<typeof createSurfaceResult>) {
  const pitch = Math.atan(-Math.sin(yaw) * surface.gradientX - Math.cos(yaw) * surface.gradientZ);
  const roll = Math.atan(Math.cos(yaw) * surface.gradientX - Math.sin(yaw) * surface.gradientZ);
  return { pitch, roll };
}
export function roadQuaternion(yaw: number, surface: ReturnType<typeof createSurfaceResult>) {
  const { pitch, roll } = roadOrientation(yaw, surface);
  const sx = Math.sin(pitch / 2), cx = Math.cos(pitch / 2), sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2), sz = Math.sin(roll / 2), cz = Math.cos(roll / 2);
  return { x: sx * cy * cz + cx * sy * sz, y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz, w: cx * cy * cz + sx * sy * sz };
}
