import type { TrackData } from "./trackData";
import { architecturePlacements } from "./taiwanArchitecture";
import { distanceToTrack } from "./trackPath";

export const TAIPEI_WORLD = { riverWidth: 44, bankWidth: 8, grid: 29, mountainRadius: 610, mountainSegments: 96 } as const;
export type WorldBuilding = { x: number; z: number; width: number; depth: number; height: number; color: string; tower: boolean };
export function taipeiRiverX(track: TrackData, z: number) {
  return track.bounds.centerX - track.bounds.width / 2 - 94 + Math.sin((z - track.bounds.centerZ) / 150) * 14;
}
/** Fictional basin, authored around the existing circuit. The same horizontal
 * exclusions cover elevated roads too, so no background tower pierces a deck.
 */
export function createTaipeiWorld(track: TrackData) {
  const { centerX: cx, centerZ: cz, width, depth } = track.bounds;
  const roads = [track.samples, ...track.branches.map(branch => branch.samples)];
  const architecture = architecturePlacements(track, "taipei");
  const bridges = [cz - depth / 2 - 52, cz + depth / 2 + 64];
  const buildings: WorldBuilding[] = [];
  for (let row = -7; row <= 7; row++) for (let col = -10; col <= 10; col++) {
    const seed = Math.abs(Math.sin(row * 91.73 + col * 13.41) * 43758.5453) % 1;
    const x = cx + col * TAIPEI_WORLD.grid, z = cz + row * TAIPEI_WORLD.grid;
    if (bridges.some(bridge => Math.abs(z - bridge) < 18 && Math.abs(x - taipeiRiverX(track, bridge)) < 150)) continue;
    const w = 11 + seed * 7, d = 12 + ((seed * 7) % 1) * 6, radius = Math.hypot(w, d) / 2 + 2;
    if (Math.abs(x - taipeiRiverX(track, z)) < TAIPEI_WORLD.riverWidth / 2 + TAIPEI_WORLD.bankWidth + radius) continue;
    if (roads.some(road => distanceToTrack(x, z, road, { closed: road === track.samples }) < radius + 16)) continue;
    if (architecture.some(p => Math.hypot(x - p.position[0], z - p.position[2]) < p.radius + radius + 3)) continue;
    if ((row + col) % 7 === 0) continue; // Open courtyards break up the city mass.
    const outer = Math.abs(x - cx) > width / 2 + 20 || Math.abs(z - cz) > depth / 2 + 20;
    buildings.push({ x, z, width: w, depth: d, height: outer ? (x > cx ? 40 + seed * 40 : 20 + seed * 22) : 12 + seed * 15,
      color: ["#71868b", "#9c9d95", "#758d89", "#a9988c", "#667f8a"][Math.floor(seed * 5)], tower: outer && seed > .45 });
  }
  return { buildings, bridges, center: [cx, cz] as const };
}
