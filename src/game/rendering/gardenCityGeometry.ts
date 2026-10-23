import { worldRidgeGeometry } from "./worldRidgeGeometry";
import { gardenStreetDetails } from "./gardenStreetDetails";
import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, PlaneGeometry, SphereGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TrackData } from "../track/trackData";
import type { CityTrackId } from "../track/cityTracks";
import { cityWorldLayout } from "../track/gardenCities";

/** One merged mesh per world; window strips avoid hundreds of draw calls. */
export function gardenCityGeometry(track: TrackData, id: CityTrackId, low: boolean) {
  const parts: BufferGeometry[] = [], old = id === "tainan", layout = cityWorldLayout(track, id);
  function add(geometry: BufferGeometry, tint: string) {
    const color = new Color(tint), data = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < data.length; i += 3) color.toArray(data, i);
    geometry.setAttribute("color", new Float32BufferAttribute(data, 3)); geometry.deleteAttribute("uv"); parts.push(geometry);
  }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => add(new BoxGeometry(w, h, d).translate(x, y, z), color);
  const cx = track.bounds.centerX, cz = track.bounds.centerZ;
  box(cx, -1, cz, 2400, 1, 2400, old ? "#9daa7c" : "#7ea88a");
  for (let row = -7; row <= 7; row++) box(cx + 20, -.39, cz + row * 42 + 21, 725, .04, 5, old ? "#c5b196" : "#9aaeb0");
  for (let col = -8; col <= 8; col++) {
    if (col === -6) continue;
    box(cx + col * 42 + 21, -.38, cz, 5, .04, 640, old ? "#c5b196" : "#9aaeb0");
  }
  box(cx - 252, -.3, cz, 24, .15, 680, old ? "#5eaaa7" : "#b4c99a");
  for (const side of [-1, 1]) box(cx - 252 + side * 13, -.15, cz, 2, .2, 680, "#e7d6b3");
  for (const z of [-230, 0, 230]) {
    box(cx - 252, .3, cz + z, 32, .8, 7, "#dfb88c");
    for (const side of [-1, 1]) box(cx - 252, 1.1, cz + z + side * 3.4, 32, .8, .4, "#b0795e");
  }
  layout.buildings.forEach((b, i) => {
    add(new PlaneGeometry(28, 27).rotateX(-Math.PI / 2).translate(b.x, 0, b.z), old ? "#c8ad89" : "#b4beaa");
    if (old) box(b.x + 8, 2.5, b.z + 4, 8, 5, 12, old ? "#d3a07e" : "#9eb9ae");
    if (old) box(b.x + 8, 5.1, b.z + 4, 9, .3, 13, old ? "#9f654d" : "#689178");
    box(b.x, b.height / 2, b.z, b.width, b.height, old ? 15 : 25, old ? i % 2 ? "#c08a6e" : "#dab28e" : i % 2 ? "#adc7c7" : "#e3ddc4");
    if (old) add(new ConeGeometry(13, 3, 4).rotateY(Math.PI / 4).translate(b.x, b.height + 1.5, b.z), "#99674e");
    else box(b.x, b.height, b.z, b.width + 1, 1, 26, "#657e83");
    for (let floor = 0; floor < (low ? 1 : 3); floor++) for (const side of [-1, 1]) add(new PlaneGeometry(old ? 12 : 22, 1.4).rotateY(side < 0 ? Math.PI : 0).translate(b.x, 2 + floor * (b.height - 3) / (low ? 1 : 3), b.z + side * (old ? 7.55 : 12.55)), floor % 2 ? "#f0ce8d" : "#517c80");
    if (!old) {
      // A continuous podium anchors the towers to the pedestrian city.
      box(b.x, 2, b.z, 29, 4, 28, "#c9cbb8");
      for (const side of [-1, 1]) {
        add(new PlaneGeometry(24, 2).rotateY(side < 0 ? Math.PI : 0).translate(b.x, 2.2, b.z + side * 14.05), "#567d77");
        add(new PlaneGeometry(20, b.height * .6).rotateY(side * Math.PI / 2).translate(b.x + side * (b.width / 2 + .05), b.height * .55, b.z), "#719b9b");
      }
      if (b.height < 25) box(b.x, b.height + .6, b.z, 18, 1, 18, "#719464");
    }
    if ((old && !low) || i % (low ? 6 : 3) === 0) {
      box(b.x - 9, .35, b.z - 7, 3, .7, 5, "#929b74");
      add(new SphereGeometry(2, 5, 4).scale(1, 1.4, 1).translate(b.x - 9, 2.8, b.z - 7), old ? "#879850" : "#58826a");
    }
  });
  layout.streets.forEach(s => {
    if (s.position[1] > .1) box(s.position[0], s.position[1] / 2, s.position[2], 9.5, s.position[1], 9.5, "#9a927c");
  });
  layout.trees.forEach((tree, i) => {
    if (low && i % 2) return;
    add(new CylinderGeometry(.35, .55, 4, 6).translate(tree.x, 2, tree.z), "#947359");
    add(new SphereGeometry(3.6, low ? 5 : 7, low ? 4 : 5).scale(1, 1.3, 1).translate(tree.x, 6, tree.z), i % 3 ? "#518667" : "#91ac6b");
  });
  const [x, , z] = layout.landmark;
  box(x, 0, z, 68, .6, 48, "#dac5a2");
  if (old) {
    for (const side of [-1, 1]) box(x + side * 17, 6, z, 18, 12, 18, "#b36f57");
    box(x, 13, z, 52, 3, 18, "#c78b64");
    for (let tier = 0; tier < 3; tier++) {
      box(x, 16 + tier * 4, z, 30 - tier * 6, 3, 14 - tier * 2, "#e7c19a");
      add(new ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).scale(28 - tier * 5, 3, 16 - tier * 2).translate(x, 18 + tier * 4, z), "#89543f");
    }
  } else {
    // Original scalloped exhibition pavilion with a planted roof garden.
    for (let i = -2; i <= 2; i++) {
      add(new CylinderGeometry(8, 10, 18 + (2 - Math.abs(i)) * 3, 16).translate(x + i * 11, 9, z), "#eee1be");
      add(new SphereGeometry(8, low ? 6 : 12, low ? 4 : 8).scale(1, .4, 1).translate(x + i * 11, 19, z), "#81ac8b");
      box(x + i * 11, 7, z - 9.5, 5, 10, 1, "#577f88");
    }
  }
  parts.push(worldRidgeGeometry(track, old ? 60 : 85, ["#809d86", "#9db4a2", "#b8c7b3"]));
  gardenStreetDetails(track, id, low, add);
  const merged = mergeGeometries(parts); parts.forEach(p => p.dispose()); return merged;
}
