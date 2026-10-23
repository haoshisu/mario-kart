import type { TrackData } from "./trackData";
import { distanceToTrack, pointAtTrackOffset } from "./trackPath";

const cache = new WeakMap<TrackData, readonly number[]>();
/** Shared cut-slope surface for rendering and planting roots on actual soil. */
export function taiwanSlopeVertices(track: TrackData): readonly number[] {
  const cached = cache.get(track);
  if (cached) return cached;
  const vertices: number[] = [];
  if (track.id === "jiufen" || track.id === "alishan") {
    const route = track.samples.filter((_, i) => i % 5 === 0), roads = [track.samples, ...track.branches.map(b => b.samples)];
    for (let i = 0; i < route.length; i++) for (const side of [-1, 1]) {
      const a = route[i], b = route[(i + 1) % route.length];
      if (Math.min(a.height, b.height) < 2) continue;
      const points = [a, b].map(p => [7, 16, 25].map((offset, row) => {
        const [x, z] = pointAtTrackOffset(p, side * offset);
        return [x, row === 0 ? p.height - .6 : row === 1 ? p.height * .7 - 2 : -.15, z] as const;
      }));
      // Validate each strip independently so an outer strip near another road
      // cannot remove the soil beneath an otherwise safe inner grove.
      for (let row = 0; row < 2; row++) {
        const quad = [points[0][row], points[1][row], points[0][row + 1], points[1][row + 1]];
        if (quad.some(p => roads.some(road => distanceToTrack(p[0], p[2], road, { closed: road === track.samples }) < 5.7))) continue;
        for (const index of [0, 1, 2, 2, 1, 3]) vertices.push(...quad[index]);
      }
    }
  }
  cache.set(track, vertices); return vertices;
}

export function taiwanSoilHeight(track: TrackData, x: number, z: number) {
  const vertices = taiwanSlopeVertices(track);
  let height = 0;
  for (let i = 0; i < vertices.length; i += 9) {
    const ax = vertices[i], az = vertices[i + 2], bx = vertices[i + 3], bz = vertices[i + 5], cx = vertices[i + 6], cz = vertices[i + 8];
    const determinant = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(determinant) < .0001) continue;
    const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / determinant;
    const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / determinant, c = 1 - a - b;
    if (Math.min(a, b, c) >= -.0001) height = Math.max(height, a * vertices[i + 1] + b * vertices[i + 4] + c * vertices[i + 7]);
  }
  return height;
}
