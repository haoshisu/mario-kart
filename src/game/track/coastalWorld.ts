import { distanceToTrack } from "./trackPath";
import { architecturePlacements } from "./taiwanArchitecture";
import type { TrackData } from "./trackData";

export type CoastalCity = "jiufen" | "kaohsiung";
export type CoastalBuilding = { x: number; y: number; z: number; width: number; depth: number; height: number; color: string; hillside?: boolean };
export const COASTAL_WORLD = { seaSize: 10000, hillStep: 32, hillRows: 10, hillColumns: 30, portLandDepth: 270 } as const;
export function coastalEdges(track: TrackData) {
  return { north: track.bounds.centerZ + track.bounds.depth / 2, west: track.bounds.centerX - track.bounds.width / 2 };
}
/** Grid-aligned foundations share the exact vertices of the hillside mesh. */
export function jiufenHillHeight(column: number, row: number) {
  const taper = Math.max(0, 1 - Math.abs(column) / 16);
  return row === 0 ? .08 : (row * 10 + Math.sin(column * .6 + row * .4) * row * 1.8) * taper;
}
export function jiufenShoreX(track: TrackData, z: number) {
  const south = track.bounds.centerZ - track.bounds.depth / 2 - 80;
  const t = Math.max(0, Math.min(1, (z - south) / (coastalEdges(track).north + 28 - south)));
  return track.bounds.centerX + track.bounds.width * .18 + (480 - track.bounds.width * .18) * t ** 4 + Math.sin(t * Math.PI * 3) * 25;
}
export function createCoastalWorld(track: TrackData, id: CoastalCity) {
  const { north, west } = coastalEdges(track), buildings: CoastalBuilding[] = [];
  if (id === "jiufen") {
    for (let row = 1; row < 9; row++) for (let col = -10; col <= 10; col++) {
      if ((col + row) % 3 === 0) continue;
      const seed = Math.abs(Math.sin(col * 17 + row * 71));
      buildings.push({ x: track.bounds.centerX + col * 32, y: jiufenHillHeight(col, row), z: north + 28 + row * 32,
        width: 23 + seed * 3, depth: 20, height: 6 + seed * 6, color: ["#9a725b", "#b69572", "#735f51"][Math.abs(col + row) % 3] });
    }
    const roads = [track.samples, ...track.branches.map(b => b.samples)];
    const landmarks = architecturePlacements(track, id);
    let lowerHomes = 0;
    for (let z = track.bounds.centerZ - track.bounds.depth / 2; z < north; z += 28) for (let x = track.bounds.centerX - track.bounds.width / 2 - 25; x < track.bounds.centerX + track.bounds.width / 2; x += 26) {
      if (lowerHomes >= 40 || x > Math.min(jiufenShoreX(track,z-7),jiufenShoreX(track,z+7)) - 12) continue;
      if (roads.some(road => distanceToTrack(x,z,road,{closed:road===track.samples}) < 23)) continue;
      if (landmarks.some(b => Math.hypot(x-b.position[0],z-b.position[2]) < b.radius+13)) continue;
      buildings.push({x,y:-.15,z,width:14,depth:12,height:6+lowerHomes%3*2,color:lowerHomes%2?"#a78868":"#8c7058",hillside:false});
      lowerHomes++;
    }
  } else {
    for (let row = 0; row < 5; row++) for (let col = -6; col <= 9; col++) {
      if ((col + row) % 5 === 0) continue;
      const seed = Math.abs(Math.sin(col * 39 + row * 13));
      buildings.push({ x: track.bounds.centerX + col * 36, y: .25, z: north + 66 + row * 38,
        width: 15 + seed * 6, depth: 18, height: col < 0 ? 12 + seed * 10 : 30 + seed * 45, color: ["#8caaa8", "#bcb19a", "#7d9ba6"][Math.abs(col + row) % 3] });
    }
  }
  return { buildings, north, west, centerX: track.bounds.centerX, centerZ: track.bounds.centerZ };
}
