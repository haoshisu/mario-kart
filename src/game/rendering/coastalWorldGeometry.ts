import { worldRidgeGeometry } from "./worldRidgeGeometry";
import { BoxGeometry, BufferGeometry, Color, ConeGeometry, Float32BufferAttribute, Matrix4, PlaneGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COASTAL_WORLD, createCoastalWorld, jiufenHillHeight, jiufenShoreX, type CoastalCity } from "../track/coastalWorld";
import { pointAtTrackOffset } from "../track/trackPath";
import type { TrackData } from "../track/trackData";

class WorldMesh {
  parts: BufferGeometry[] = [];
  add(geometry: BufferGeometry, hex: string) {
    const color = new Color(hex), colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    // Every part has the same attributes before merging; color supplies all detail.
    geometry.deleteAttribute("uv"); this.parts.push(geometry);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    this.add(new BoxGeometry(w, h, d).translate(x, y, z), color);
  }
  beam(a: readonly [number, number, number], b: readonly [number, number, number], width: number, color: string) {
    const start = new Vector3(...a), end = new Vector3(...b), direction = end.clone().sub(start);
    const matrix = new Matrix4().lookAt(start, end, new Vector3(0, 1, 0));
    this.add(new BoxGeometry(width, width, direction.length()).applyMatrix4(matrix).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), color);
  }
  finish() { const geometry = mergeGeometries(this.parts); this.parts.forEach(p => p.dispose()); return geometry; }
}

export function coastalBuildingsGeometry(track: TrackData, id: CoastalCity, low: boolean) {
  const mesh = new WorldMesh(), world = createCoastalWorld(track, id);
  world.buildings.forEach(b => {
    if (id === "jiufen") {
      // Pedestals penetrate the slope and support the whole flat house footprint.
      if (!low) mesh.box(b.x, b.y - 2.5, b.z, b.width + 3, 8, b.depth + 3, "#756e5b");
      mesh.box(b.x, b.y - 2.5 + b.height / 2, b.z, b.width, b.height + 8, b.depth, b.color);
      mesh.add(new ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).scale(b.width * .85, 3, b.depth * .85).translate(b.x, b.y + b.height + 3, b.z), "#405d58");
      for (const x of [-.28, .28]) {
        mesh.add(new PlaneGeometry(3.5, 2.3).rotateY(Math.PI).translate(b.x + b.width * x, b.y + 4, b.z - b.depth / 2 - .04), "#f0c884");
        if (!low) mesh.box(b.x + b.width * x, b.y + 7, b.z - b.depth / 2 - .05, 2, 1.7, .08, "#334f4b");
      }
      if (!low) mesh.box(b.x, b.y + 2.1, b.z - b.depth / 2 - .7, b.width + 1, .3, 1.6, "#b0936a");
    } else {
      mesh.add(new PlaneGeometry(b.width + 9, b.depth + 10).rotateX(-Math.PI / 2).translate(b.x, b.y + .04, b.z), "#b3b9a3");
      mesh.box(b.x, b.y + b.height / 2, b.z, b.width, b.height, b.depth, b.color);
      if (b.height < 24) {
        for (const side of [-1, 1]) mesh.add(new PlaneGeometry(b.width / 2 + 1, b.depth + 2).rotateX(-Math.PI / 2).rotateZ(-side * .25).translate(b.x + side * b.width / 4, b.y + b.height, b.z), "#527f83");
      } else if (!low) mesh.box(b.x, b.y + b.height, b.z, b.width + 1, .7, b.depth + 1, "#d4d8c5");
      for (let row = 0; row < (low ? 2 : 4); row++) for (const side of [-1, 1]) {
        mesh.add(new PlaneGeometry(b.depth * .78, 1.8).rotateY(side * Math.PI / 2).translate(b.x + side * (b.width / 2 + .04), b.y + 5 + row * (b.height - 10) / (low ? 2 : 4), b.z), "#466e7c");
      }
      for (let row = 0; row < (low ? 3 : 5); row++) for (const side of [-1, 1]) {
        mesh.add(new PlaneGeometry(b.width * .78, 1.8).rotateY(side < 0 ? Math.PI : 0).translate(b.x, b.y + 5 + row * (b.height - 10) / (low ? 3 : 5), b.z + side * (b.depth / 2 + .05)), row % 2 ? "#d8c796" : "#466e7c");
      }
    }
  });
  return mesh.finish();
}

export function coastalLandGeometry(track: TrackData, id: CoastalCity) {
  const mesh = new WorldMesh(), { north, centerX } = createCoastalWorld(track, id);
  if (id === "kaohsiung") {
    mesh.box(centerX, -.35, north + 150, 920, 1.2, COASTAL_WORLD.portLandDepth, "#85998d");
    for (let row = 0; row < 5; row++) mesh.box(centerX, .28, north + 45 + row * 38, 900, .04, 6, "#536d72");
    for (let col = -7; col < 11; col++) mesh.box(centerX + col * 36 + 18, .28, north + 150, 6, .04, 260, "#536d72");
    // Low waterfront streets sit on a continuous quay; the high bridge stays over sea.
    const route = track.samples.filter((_, i) => i % 5 === 0);
    for (let i = 0; i < route.length; i++) {
      const a = route[i], b = route[(i + 1) % route.length];
      if (Math.max(a.height, b.height) > 12) continue;
      const points = [a,b].flatMap(p => [-24,24].map(offset => {
        const [x,z] = pointAtTrackOffset(p, offset); return [x,-.12,z];
      }));
      const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(points.flat(),3));
      g.setIndex([0,1,2,1,3,2]); g.computeVertexNormals(); mesh.add(g,"#a3aa91");
    }
  } else {
    const positions: number[] = [], colors: number[] = [];
    // One curved headland joins the racing town to the uphill settlement.
    // Its top stays below every road; the sea owns the remaining coastline.
    const south = track.bounds.centerZ - track.bounds.depth / 2 - 80;
    const shoreline = (t: number) => { const z = south + t * (north + 28 - south); return [jiufenShoreX(track,z), -.15, z]; };
    const groundColor = new Color("#71836b");
    for (let i = 0; i < 32; i++) {
      const a = shoreline(i / 32), b = shoreline((i + 1) / 32);
      const points = [[centerX - 480, -.15, a[2]], a, [centerX - 480, -.15, b[2]], b];
      for (const index of [0, 2, 1, 1, 2, 3]) { positions.push(...points[index]); groundColor.toArray(colors, colors.length); }
    }
    for (let row = 0; row < COASTAL_WORLD.hillRows; row++) for (let col = -15; col < 15; col++) {
      const coords = [[col, row], [col + 1, row], [col, row + 1], [col + 1, row + 1]];
      const color = new Color("#607d68");
      for (const index of [0, 2, 1, 1, 2, 3]) {
        const [c, r] = coords[index]; positions.push(centerX + c * 32, jiufenHillHeight(c, r), north + 28 + r * 32); colors.push(color.r, color.g, color.b);
      }
    }
    const hill = new BufferGeometry(); hill.setAttribute("position", new Float32BufferAttribute(positions, 3));
    hill.setAttribute("color", new Float32BufferAttribute(colors, 3)); hill.computeVertexNormals();
    // Non-indexed terrain is standalone; preserving its authored slope avoids flat floating platforms.
    return hill;
  }
  return mesh.finish();
}

export function coastalLandmarksGeometry(track: TrackData, id: CoastalCity, low: boolean) {
  const mesh = new WorldMesh(), { west, north, centerX, centerZ } = createCoastalWorld(track, id);
  if (id === "jiufen") {
    // Stair lanes follow the same hillside surface between the staggered houses.
    for (const col of [-8, -2, 5]) for (let step = 0; step < 54; step += low ? 2 : 1) {
      const row = step / 6, r = Math.floor(row), t = row - r;
      const atRow = (row: number) => (jiufenHillHeight(col, row) + jiufenHillHeight(col + 1, row)) / 2;
      const y = atRow(r) * (1 - t) + atRow(r + 1) * t;
      mesh.box(centerX + col * 32 + 16, y + .4, north + 28 + row * 32, 3, .8, low ? 11 : 5.5, "#b0a185");
    }
    // Fishing settlement and breakwater in the unplayable bay, away from the course.
    const quayZ = centerZ - track.bounds.depth / 2 - 78;
    mesh.box(centerX + 140, 0, quayZ, 130, 3, 18, "#7c8b83");
    for (let i = 0; i < 5; i++) {
      mesh.box(centerX + 95 + i * 23, 3, quayZ, 14, 5, 9, i % 2 ? "#bb9675" : "#708f8a");
      mesh.box(centerX + 95 + i * 23, 5.7, quayZ, 16, .5, 11, "#536a65");
    }
  } else {
    for (let pier = 0; pier < 3; pier++) {
      const x = west - 65 - pier * 80;
      mesh.box(x, .6, north - 20, 26, 2, 180, "#9aa99a");
      for (let k = 0; k < (low ? 2 : 4); k++) {
        const z = north + 20 - k * 29;
        for (const side of [-1, 1]) mesh.beam([x + side * 10, 1, z], [x + side * 7, 29, z], .9, "#d4ad73");
        mesh.beam([x - 18, 29, z], [x + 32, 29, z], 1.3, "#d4ad73");
        mesh.beam([x - 6, 36, z], [x + 29, 29, z], .45, "#d4ad73");
        mesh.beam([x + 29, 29, z], [x + 29, 8, z], .16, "#bac2b1");
        mesh.box(x, 3.2, z + 9, 12, 4, 7, k % 2 ? "#ac755b" : "#488c91");
      }
    }
    for (let ship = 0; ship < 4; ship++) {
      const x = west - 112 - ship * 80, z = north - 80 - ship % 2 * 85;
      mesh.box(x, 2, z, 17, 5, 65, "#3e5a67");
      mesh.add(new ConeGeometry(11, 16, 3).rotateX(Math.PI / 2).translate(x, 2, z - 38), "#3e5a67");
      mesh.box(x, 5, z, 16, 1, 64, "#a79d82");
      mesh.box(x, 11, z + 23, 13, 12, 12, "#dce0cb");
      mesh.box(x, 14, z + 16.9, 10, 2, .1, "#476d7b");
      for (let row = 0; row < 4; row++) for (const side of [-1, 1]) mesh.box(x + side * 4, 7.5, z - 23 + row * 10, 7, 4, 8, ["#c58455", "#4f8d88", "#899caa"][row % 3]);
    }
  }
  return mesh.finish();
}

export function coastalHorizonGeometry(track: TrackData, id: CoastalCity) {
  const mesh = new WorldMesh(), { centerX, centerZ } = createCoastalWorld(track, id);
  // A northern ridge leaves the ocean horizon open to the south.
  mesh.parts.push(worldRidgeGeometry(track, id === "jiufen" ? 150 : 75, ["#698780", "#829798", "#a5afb0"]));
  if (id === "jiufen") {
    // Two low offshore islands give the bay a readable depth reference.
    for (const side of [-1, 1]) mesh.add(new ConeGeometry(110, 55, 9).scale(1.7, 1, 1).translate(centerX + side * 410, 23, centerZ - 630), "#8faaa4");
  }
  return mesh.finish();
}
