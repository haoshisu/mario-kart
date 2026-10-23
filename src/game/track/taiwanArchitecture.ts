import type { TrackData } from "./trackData";
import { distanceToTrack, pointAtTrackOffset } from "./trackPath";
import { routeLength, sampleAtDistance } from "./trackPlacement";
import type { TaiwanTrackId } from "./taiwanTracks";
import { taiwanSoilHeight } from "./taiwanTerrainShape";
import { taiwanLandmarkSpots } from "./taiwanEnvironment";

export type TaiwanModule = "arcade" | "stucco" | "tea" | "warehouse" | "station" | "gate" | "tower" | "cedar" | "crane" | "ocean";
export type ArchitecturePlacement = {
  module: TaiwanModule;
  position: readonly [number, number, number];
  yaw: number;
  scale: readonly [number, number, number];
  radius: number;
  portal?: boolean;
};
/** Footprints clear every playable ribbon, including the shortcut and moving bridge.
 * Portal walls sit outside the guard rail; the open roof is at least 7.8 m above it.
 */
export function architecturePlacements(track: TrackData, id: TaiwanTrackId): ArchitecturePlacement[] {
  const result: ArchitecturePlacement[] = [], route = track.race.RACE_ROUTE_SAMPLES;
  const length = routeLength(route);
  const clear = (x: number, z: number, radius: number) => [track.samples, ...track.branches.map(b => b.samples)].every(road =>
    distanceToTrack(x, z, road, { closed: road === track.samples }) > radius + 5);
  const add = (module: TaiwanModule, position: ArchitecturePlacement["position"], yaw: number, radius: number,
    scale: ArchitecturePlacement["scale"] = [1, 1, 1], portal = false) => result.push({ module, position, yaw, radius, scale, portal });
  const spacing = id === "alishan" ? 19 : id === "kaohsiung" ? 24 : 10;
  for (let distance = 12, index = 0; distance < length; distance += spacing, index++) {
    const sample = sampleAtDistance(route, distance), f = sample.raceProgress;
    for (const side of [-1, 1]) {
      const town = id === "taipei" ? true : id === "jiufen" ? f < .4 || f > .87 : id === "kaohsiung" ? f < .3 || f > .87 : f < .09;
      const module: TaiwanModule = id === "alishan" ? town ? "station" : "cedar"
        : id === "kaohsiung" ? "warehouse" : id === "jiufen" ? "tea" : index % 3 ? "arcade" : "stucco";
      if (!town && id !== "alishan") continue;
      if (id === "alishan" && town && index % 3) continue;
      const radius = module === "warehouse" || module === "station" ? 11.5 : module === "cedar" ? 4.5 : 6.5;
      const offset = radius + 6.1;
      const [x, z] = pointAtTrackOffset(sample, side * offset);
      if (!clear(x, z, radius)) continue;
      const y = id === "taipei" ? Math.max(0, sample.height - 9.5) : id === "kaohsiung" ? 0 : sample.height;
      const scale = module === "cedar" ? .85 + index % 4 * .13 : 1;
      add(module, [x, module === "cedar" ? taiwanSoilHeight(track, x, z) : y, z], Math.atan2(-side * sample.normal[0], -side * sample.normal[1]), radius, [scale, scale, scale]);
      // Back streets have a second row. Their inexpensive distant silhouette remains
      // visible when the detailed facade is outside the camera's working distance.
      if ((id === "taipei" || id === "jiufen") && index % 3 === 0) {
        const [bx, bz] = pointAtTrackOffset(sample, side * (offset + 11));
        if (clear(bx, bz, radius)) add(module, [bx, Math.max(0, y - 2), bz], Math.atan2(-side * sample.normal[0], -side * sample.normal[1]), radius);
      }
    }
  }
  const portals = id === "taipei" ? [.075] : id === "kaohsiung" ? [.135, .17, .205] : id === "alishan" ? [.045, .405] : [];
  for (const fraction of portals) {
    const s = sampleAtDistance(route, fraction * length), module = id === "taipei" ? "gate" : id === "alishan" ? "station" : "warehouse";
    const sideClearance = module === "gate" ? 8.8 : 7;
    if (![-1, 1].every(side => clear(...pointAtTrackOffset(s, side * sideClearance), module === "gate" ? .4 : .5))) continue;
    add(module, [s.position[0], s.height, s.position[1]], Math.atan2(-s.tangent[0], -s.tangent[1]), module === "gate" ? 15 : 12, [1, 1, 1], true);
  }
  const landmarks = taiwanLandmarkSpots(track, id);
  if (id === "taipei") add("tower", landmarks[0].position, 0, 20);
  if (id === "kaohsiung") {
    add("crane", landmarks[0].position, .3, 21);
    add("ocean", landmarks[1].position, .2, 21);
  }
  if (id === "jiufen") for (const [i, spot] of landmarks.entries()) {
    for (let tier = 0; tier < 3; tier++) add("tea", [spot.position[0] + tier * 2, spot.position[1] + tier * 5, spot.position[2] + tier * 3], i * .3, 15);
  }
  if (id === "alishan") for (const spot of landmarks) add("cedar", [spot.position[0], taiwanSoilHeight(track, spot.position[0], spot.position[2]), spot.position[2]], 0, 15, [2.8, 2.8, 2.8]);
  return result;
}
