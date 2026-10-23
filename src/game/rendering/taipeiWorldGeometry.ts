import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Matrix4, PlaneGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TAIPEI_WORLD, taipeiRiverX, type WorldBuilding } from "../track/taipeiWorld";
import { distanceToTrack } from "../track/trackPath";
import { architecturePlacements } from "../track/taiwanArchitecture";
import type { TrackData } from "../track/trackData";

function tint(geometry: BufferGeometry, hex: string) {
  const color = new Color(hex), colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}
export function worldBuildingGeometry(buildings: readonly WorldBuilding[], low: boolean) {
  const parts: BufferGeometry[] = [];
  buildings.forEach(b => {
    const box = (w: number, h: number, d: number, y: number, color: string) => {
      const geometry = new BoxGeometry(w, h, d);
      // Roofs are solid coping, not a continuation of the window atlas.
      const uv = geometry.attributes.uv, normal = geometry.attributes.normal;
      for (let v = 0; v < normal.count; v++) if (Math.abs(normal.getY(v)) > .5) uv.setXY(v, .02, .01);
      parts.push(tint(geometry.translate(b.x, y, b.z), color));
    };
    box(b.width, b.height, b.depth, b.height / 2, b.color);
    if (!low) box(b.width + .8, .65, b.depth + .8, b.height + .32, "#a6b5ac");
    if (b.tower && !low) box(b.width * .6, b.height * .2, b.depth * .6, b.height * 1.1, "#739697");
  });
  const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose()); return geometry;
}
export function basinMountainGeometry(track: TrackData) {
  const positions: number[] = [], colors: number[] = [];
  const n = TAIPEI_WORLD.mountainSegments;
  for (let layer = 0; layer < 3; layer++) {
    const color = new Color(["#617d7b", "#7d8e90", "#999da2"][layer]);
    const point = (i: number, ring: number): [number, number, number] => {
      const a = i / n * Math.PI * 2;
      const ridge = 90 + layer * 30 + 48 * Math.sin(a * 5 + layer) + 24 * Math.cos(a * 9 - .7);
      const radius = TAIPEI_WORLD.mountainRadius + layer * 155 + ring * 100;
      return [track.bounds.centerX + Math.cos(a) * radius, ring === 1 ? ridge : -2, track.bounds.centerZ + Math.sin(a) * radius * .86];
    };
    for (let i = 0; i < n; i++) for (let ring = 0; ring < 2; ring++) {
      const p = [point(i, ring), point(i + 1, ring), point(i, ring + 1), point(i + 1, ring + 1)];
      for (const index of [0, 2, 1, 1, 2, 3]) {
        positions.push(...p[index]); const shade = ring ? .91 : 1;
        colors.push(color.r * shade, color.g * shade, color.b * shade);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals(); return geometry;
}
export function riverStripGeometry(track: TrackData, from: number, to: number, height: number) {
  const positions: number[] = [], uv: number[] = [];
  for (let i = 0; i < 64; i++) {
    const z1 = track.bounds.centerZ - 560 + i * 17.5, z2 = z1 + 17.5;
    const points = [[taipeiRiverX(track, z1) + from, height, z1], [taipeiRiverX(track, z1) + to, height, z1],
      [taipeiRiverX(track, z2) + from, height, z2], [taipeiRiverX(track, z2) + to, height, z2]];
    for (const index of [0, 2, 1, 1, 2, 3]) { positions.push(...points[index]); uv.push(index % 2, (i + (index >= 2 ? 1 : 0)) / 8); }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals(); return geometry;
}
export function bridgeGeometry(track: TrackData, bridges: readonly number[]) {
  const parts: BufferGeometry[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => parts.push(tint(new BoxGeometry(w, h, d).translate(x, y, z), color));
  for (const z of bridges) {
    const x = taipeiRiverX(track, z);
    box(x, 7, z, 132, 2, 12, "#899f9d");
    for (const side of [-1, 1]) {
      box(x, 8.5, z + side * 5.5, 132, 1, .4, "#d2cbb3");
      box(x + side * 29, 20, z, 1.8, 40, 1.8, "#d2cbb3");
      for (const along of [-1, 1]) for (let k = 1; k <= 5; k++) {
        const startX = x + side * 29, endX = startX + along * k * 6;
        const dx = endX - startX, dy = 8 - 37;
        const beam = new BoxGeometry(.12, Math.hypot(dx, dy), .12);
        beam.applyMatrix4(new Matrix4().makeRotationZ(-Math.atan2(dx, dy)));
        beam.translate((startX + endX) / 2, 22.5, z);
        parts.push(tint(beam, "#c6bda5"));
      }
    }
    for (const side of [-1, 1]) {
      const ramp = new BoxGeometry(60.4, 1.2, 12);
      ramp.rotateZ(-side * Math.atan2(7, 60)); ramp.translate(x + side * 96, 3.5, z);
      parts.push(tint(ramp, "#899f9d"));
    }
    for (const offset of [-55, -29, 29, 55]) box(x + offset, 3, z, 2.4, 6, 9, "#728984");
  }
  const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose()); return geometry;
}

/** Local streets join blocks only where the complete segment clears the circuit. */
export function districtGroundGeometry(track: TrackData, buildings: readonly WorldBuilding[], _low: boolean) {
  const parts: BufferGeometry[] = [];
  buildings.forEach(b => {
    parts.push(tint(new PlaneGeometry(24, 24).rotateX(-Math.PI / 2).translate(b.x, .02, b.z), "#989e90"));
  });
  const architecture = architecturePlacements(track, "taipei");
  const roads = [track.samples, ...track.branches.map(b => b.samples)];
  for (let row = -7; row <= 7; row++) for (let col = -10; col <= 10; col++) for (const horizontal of [true, false]) {
    const x = track.bounds.centerX + (col + (horizontal ? 0 : .5)) * 29;
    const z = track.bounds.centerZ + (row + (horizontal ? .5 : 0)) * 29;
    if (Math.abs(x - taipeiRiverX(track, z)) < 49) continue;
    if (roads.some(road => distanceToTrack(x, z, road, { closed: road === track.samples }) < 23)) continue;
    if (architecture.some(p => Math.hypot(x - p.position[0], z - p.position[2]) < p.radius + 17)) continue;
    const plane = new PlaneGeometry(horizontal ? 29 : 5, horizontal ? 5 : 29).rotateX(-Math.PI / 2).translate(x, .035, z);
    parts.push(tint(plane, "#536366"));
  }
  const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose()); return geometry;
}
