import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TrackData } from "../track/trackData";
import { distanceToTrack } from "../track/trackPath";
import { architecturePlacements } from "../track/taiwanArchitecture";
import { worldRidgeGeometry } from "./worldRidgeGeometry";

/** A continuous wooded mountain surrounds the existing cut slopes and tea terraces. */
export function alishanWorldGeometry(track: TrackData, low: boolean) {
  const roads = [track.samples, ...track.branches.map(b => b.samples)];
  const landmarks = architecturePlacements(track, "alishan");
  const cx = track.bounds.centerX, cz = track.bounds.centerZ;
  const parts: BufferGeometry[] = [], positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const size = 28, count = 32;
  const vertices: { x: number; z: number; y: number; clear: number }[] = [];
  const tint = new Color();
  for (let row = 0; row <= count; row++) for (let col = 0; col <= count; col++) {
    const x = cx + (col - count / 2) * size, z = cz + (row - count / 2) * size;
    const clear = Math.min(...roads.map(road => distanceToTrack(x, z, road, { closed: road === track.samples })));
    // Keep a broad depression around all driving ribbons; existing slopes fill it.
    const edge = Math.min(1, Math.min(row, col, count - row, count - col) / 3);
    const y = Math.max(-.15, Math.min(95, (clear - 65) * .35)) * (.8 + .2 * Math.sin(col * .5) * Math.cos(row * .4)) * edge - .02;
    vertices.push({x,z,y,clear}); positions.push(x,y,z);
    tint.set(row < 12 ? "#7c8b58" : row > 22 ? "#486d5d" : "#597a58"); tint.toArray(colors, colors.length);
    if (row < count && col < count) {
      const a = row * (count + 1) + col;
      indices.push(a, a + count + 1, a + 1, a + 1, a + count + 1, a + count + 2);
    }
  }
  const land = new BufferGeometry();
  land.setAttribute("position", new Float32BufferAttribute(positions, 3));
  land.setAttribute("color", new Float32BufferAttribute(colors, 3)); land.setIndex(indices); land.computeVertexNormals(); parts.push(land);
  const add = (g: BufferGeometry, color: string) => {
    const data = new Float32Array(g.attributes.position.count * 3); tint.set(color);
    for (let i = 0; i < data.length; i += 3) tint.toArray(data, i);
    g.setAttribute("color", new Float32BufferAttribute(data, 3)); g.deleteAttribute("uv"); parts.push(g);
  };
  vertices.forEach((vertex, i) => {
    if (i % (count + 1) === count || i >= count * (count + 1)) return;
    const noise = (seed: number) => { const n = Math.sin(seed * 12.9898) * 43758.5453; return n - Math.floor(n); };
    const u = .12 + noise(i + 1) * .76, v = .12 + noise(i + 731) * .76;
    const right = vertices[i + 1], back = vertices[i + count + 1], diagonal = vertices[i + count + 2];
    // Interpolate the same two terrain triangles, so staggered groves stay rooted.
    const y = u + v <= 1 ? vertex.y + (right.y - vertex.y) * u + (back.y - vertex.y) * v
      : diagonal.y + (back.y - diagonal.y) * (1 - u) + (right.y - diagonal.y) * (1 - v);
    const x = vertex.x + u * size, z = vertex.z + v * size;
    const clear = Math.min(...roads.map(road => distanceToTrack(x, z, road, { closed: road === track.samples })));
    const p = {x,y,z,clear};
    if (p.clear < 30 || Math.hypot(p.x - cx, p.z - cz) > 405) return;
    if (landmarks.some(b => Math.hypot(p.x - b.position[0], p.z - b.position[2]) < b.radius + 9)) return;
    const h = 15 + noise(i + 91) * 12;
    add(new CylinderGeometry(.6, 1.1, h * .65, low ? 4 : 6, 1, true).translate(p.x, p.y + h * .325, p.z), "#70563e");
    for (let tier = 0; tier < (low ? 2 : 3); tier++) {
      add(new ConeGeometry(7 - tier * 1.6, h * .6, low ? 5 : 7).translate(p.x, p.y + h * (.5 + tier * .2), p.z), p.z < cz - 100 ? "#799151" : i % 3 ? "#426c50" : "#5b8059");
    }
  });
  parts.push(worldRidgeGeometry(track, 155, ["#5b786c", "#7e9488", "#a4b1a2"]));
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g;
}
