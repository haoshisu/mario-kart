import { BoxGeometry, BufferGeometry, PlaneGeometry } from "three";
import type { TainanHouse } from "../track/tainanWorld";

type AddGeometry = (geometry: BufferGeometry, color: string) => void;
const PALETTES = {
  market: { walls: ["#b96745", "#ce8b58", "#d9a86d", "#ac573e", "#c27c54"], roof: "#873f2d", trim: "#edc99b", window: "#385f54" },
  canal: { walls: ["#bdab87", "#c2b797", "#d6c5a4", "#b1a082", "#c8ad83"], roof: "#526a65", trim: "#e8d5ae", window: "#4c6864" },
  residential: { walls: ["#d8c595", "#c8c59f", "#e0d3b0", "#c2b88c", "#d4c4a2"], roof: "#a66a49", trim: "#f0dfb8", window: "#5e7869" },
} as const;

/** All details stay inside the existing house envelope, including the arcade. */
export function addTainanHouse(b: TainanHouse, low: boolean, add: AddGeometry) {
  const palette = PALETTES[b.district], top = b.y + b.height;
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => {
    const geometry = new BoxGeometry(w, h, d);
    // Foundations and parapets are never viewed from underneath.
    const indices = Array.from(geometry.index?.array ?? []);
    geometry.setIndex([...indices.slice(0, 18), ...indices.slice(24)]);
    geometry.clearGroups();
    add(geometry.translate(b.x + x, b.y + y, b.z + z), color);
  };
  const front = (x: number, y: number, side: number, w: number, h: number, color: string, depth = 8.79) =>
    add(new PlaneGeometry(w, h).rotateY(side < 0 ? Math.PI : 0).translate(b.x + x, b.y + y, b.z + side * depth), color);
  box(0, b.height / 2 - 1, 0, 15.9, b.height + 2, 17.5, palette.walls[b.color]);
  // Residential terraces alternate with tiled roofs; canal roofs run across the row.
  const terrace = b.district === "residential" && b.color % 2 === 0;
  if (terrace) {
    add(new PlaneGeometry(15.9, 17.5).rotateX(-Math.PI / 2).translate(b.x, top + .03, b.z), "#c3aa80");
    for (const side of [-1, 1]) {
      if (low) front(0, b.height + .5, side, 15.9, 1, palette.trim, 8.3);
      else box(0, b.height + .5, side * 8.3, 15.9, 1, .5, palette.trim);
    }
  } else {
    const cross = b.district === "canal";
    for (const side of [-1, 1]) {
      const panel = low ? new PlaneGeometry(8.7, 19.6).rotateX(-Math.PI / 2) : new BoxGeometry(8.7, .35, 19.6);
      panel.rotateZ(-side * .29).translate(side * 4, 0, 0);
      if (cross) panel.rotateY(Math.PI / 2).scale(.9, 1, 1);
      add(panel.translate(b.x, top, b.z), palette.roof);
    }
    if (!low) {
      const ridge = new BoxGeometry(.45, .4, 19.4);
      if (cross) ridge.rotateY(Math.PI / 2).scale(.9, 1, 1);
      add(ridge.translate(b.x, top + 1.15, b.z), palette.trim);
    }
  }
  if (low && !b.near) {
    // Distant low-quality homes retain the district silhouette and large openings.
    for (const side of [-1, 1]) {
      front(0, 2.4, side, b.district === "canal" ? 6 : 3, 4, palette.window);
      front(4, b.height - 2.5, side, 2.8, 2.4, palette.window);
    }
    return;
  }
  for (const side of [-1, 1]) {
    front(0, .7, side, 15.8, 1.4, palette.roof, 8.82);
    if (b.near && b.district === "market") {
      // Deep, dark arcade openings and pale piers read clearly at driving speed.
      front(0, 2.6, side, 13.8, 4, palette.window);
      for (const x of [-6.5, -2.2, 2.2, 6.5]) front(x, 2.6, side, .45, 4.2, palette.trim, 8.85);
      front(0, 4.8, side, 14, .5, palette.trim, 8.9);
      for (const x of [-4.4, 4.4]) front(x, 5.7, side, 3.2, 1.1, "#a7422d", 8.9);
      if (!low) for (let stripe = -3; stripe <= 3; stripe++)
        add(new PlaneGeometry(1.8, 2.4).rotateX(-Math.PI / 2 + side * .12).translate(b.x + stripe * 1.8, b.y + 4.4, b.z + side * 9), stripe % 2 ? "#537b69" : "#e9d0a2");
    } else {
      front(0, 2.4, side, b.district === "canal" ? 6 : 3, 4, palette.window);
      front(0, 4.7, side, 7, .4, palette.trim, 8.85);
    }
    for (const x of [-5, 5]) {
      front(x, b.height - 2.5, side, 2.8, 2.4, palette.trim, 8.85);
      front(x, b.height - 2.5, side, 2, 1.8, palette.window, 8.9);
      if (!low) front(x, b.height - 2.5, side, .12, 1.8, palette.trim, 8.95);
    }
  }
  // End walls are visible along bends; they need architecture, not blank color.
  if (b.near) for (const side of [-1, 1]) {
    for (const z of [-5, 5]) add(new PlaneGeometry(2.6, 2.5).rotateY(side * Math.PI / 2)
      .translate(b.x + side * 7.97, top - 3, b.z + z), palette.window);
    add(new PlaneGeometry(16, .5).rotateY(side * Math.PI / 2)
      .translate(b.x + side * 7.98, b.y + 4.8, b.z), palette.trim);
  }
}
