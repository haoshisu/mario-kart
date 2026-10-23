import type { TrackData } from "./trackData";
import { distanceToTrack, pointAtTrackOffset } from "./trackPath";

export const TAINAN_WORLD = { canalZ: 146, canalHalfWidth: 13, centerX: -5, centerZ: 125, radiusX: 290, radiusZ: 310 } as const;
export type TainanHouse = {
  x: number; z: number; y: number; height: number; color: number; near: boolean;
  district: "market" | "canal" | "residential";
};
function buildTainanWorld(track: TrackData) {
  const roads = [track.samples, ...track.branches.map(b => b.samples)];
  const heights = track.samples.filter((_, i) => i % 6 === 0);
  const groundCache = new Map<string, number>();
  function ground(x: number, z: number) {
    const key = `${x}:${z}`, cached = groundCache.get(key);
    if (cached !== undefined) return cached;
    if (Math.abs(z - TAINAN_WORLD.canalZ) < TAINAN_WORLD.canalHalfWidth) return -4;
    let closest = heights[0], distance = Infinity, roadFloor = Infinity;
    for (const p of heights) {
      const d = Math.hypot(x - p.position[0], z - p.position[1]);
      if (d < 15) roadFloor = Math.min(roadFloor, p.height - .7);
      if (d < distance) { distance = d; closest = p; }
    }
    const height = Math.min(roadFloor, Math.max(-.7, closest.height - .65 - Math.max(0, distance - 32) * .045));
    groundCache.set(key, height); return height;
  }
  const clear = (x: number, z: number, radius: number) => roads.every(road => distanceToTrack(x, z, road, { closed: road === track.samples }) > radius + 5.2);
  const templeSample = track.race.RACE_ROUTE_SAMPLES[Math.floor(track.race.RACE_ROUTE_SAMPLES.length * .29)];
  let temple = { x: -15, z: 65, y: 0 };
  outer: for (const offset of [38,-38,55,-55,75,-75]) {
    const [x,z] = pointAtTrackOffset(templeSample, offset);
    if (clear(x,z,26) && Math.abs(z - TAINAN_WORLD.canalZ) > 42) { temple = {x,z,y:ground(x,z)}; break outer; }
  }
  const houses: TainanHouse[] = [];
  const courts: { x: number; z: number; y: number }[] = [];
  for (let row = -15; row <= 18; row++) for (let col = -17; col <= 17; col++) {
    // Attached rows form urban blocks. Wider cross streets separate neighborhoods.
    const x = col * 16 + Math.floor(col / 4) * 5, z = 125 + row * 18 + Math.floor(row / 3) * 5;
    if (((x + 5) / 270) ** 2 + ((z - 125) / 285) ** 2 > 1) continue;
    if (Math.abs(z - TAINAN_WORLD.canalZ) < 26 || !clear(x,z,10.5)) continue;
    if (Math.abs(x - temple.x) < 42 && Math.abs(z - temple.z) < 43) continue;
    const y = Math.max(ground(x-7,z-8),ground(x+7,z+8),ground(x-7,z+8),ground(x+7,z-8));
    // Small shaded courtyards interrupt long rows without opening holes in the city.
    if (Math.abs(col % 7) === 3 && Math.abs(row % 6) === 2) { courts.push({x,z,y}); continue; }
    const district = Math.abs(z - TAINAN_WORLD.canalZ) < 65 ? "canal" : z > 215 ? "residential" : "market";
    const height = district === "canal" ? 7 + Math.abs(col) % 2 * 2 : 8 + Math.abs(Math.floor(col / 3) + row) % 3 * 2;
    houses.push({x,z,y,height,district,color:Math.abs(col * 7 + row) % 5,near:roads.some(road=>distanceToTrack(x,z,road,{closed:road===track.samples})<32)});
  }
  const gate = track.race.RACE_ROUTE_SAMPLES[Math.floor(track.race.RACE_ROUTE_SAMPLES.length * .13)];
  return { ground, clear, houses, courts, temple, gate };
}

const worlds = new WeakMap<TrackData, ReturnType<typeof buildTainanWorld>>();
export function createTainanWorld(track: TrackData) {
  let world = worlds.get(track);
  if (!world) { world = buildTainanWorld(track); worlds.set(track, world); }
  return world;
}
