import type { TrackData } from "./trackData";
import type { CityTrackId } from "./cityTracks";
import type { ArchitecturePlacement } from "./taiwanArchitecture";
import { distanceToTrack, pointAtTrackOffset } from "./trackPath";

export function cityWorldLayout(track: TrackData, id: CityTrackId) {
  const roads = [track.samples, ...track.branches.map(b => b.samples)];
  const clear = (x: number, z: number, radius: number) => roads.every(road => distanceToTrack(x, z, road, { closed: road === track.samples }) > radius + 6);
  const streets: ArchitecturePlacement[] = [];
  track.samples.forEach((s, i) => {
    if (i % 22) return;
    for (const side of [-1, 1]) {
      const [x, z] = pointAtTrackOffset(s, side * 15);
      if (clear(x, z, 7)) streets.push({ module: id === "tainan" && i % 3 === 0 ? "tea" : "arcade", position: [x, Math.max(0, s.height - 7), z], yaw: Math.atan2(-side * s.normal[0], -side * s.normal[1]), radius: 7, scale: [1, 1, 1] });
    }
  });
  const buildings: { x: number; z: number; height: number; width: number }[] = [];
  for (let row = -7; row <= 7; row++) for (let col = -8; col <= 8; col++) {
    const x = track.bounds.centerX + col * 42, z = track.bounds.centerZ + row * 42;
    // A west-side linear park/canal gives each city a readable open axis.
    if (col === -6 || (id === "tainan" && (row + col) % 4 === 0) || !clear(x, z, 17)) continue;
    if (streets.some(s => Math.hypot(s.position[0] - x, s.position[2] - z) < 24)) continue;
    buildings.push({ x, z, height: id === "tainan" ? 7 + Math.abs(col + row) % 4 * 2 : (col < -2 ? 12 + Math.abs(row) % 4 * 3 : 26 + Math.abs(col * 7 + row * 3) % 38), width: id === "tainan" ? 16 : 26 });
  }
  const trees: { x: number; z: number }[] = [];
  for (let i = 0; i < 30; i++) for (const side of [-1, 1]) {
    const x = track.bounds.centerX - 252 + side * 17, z = track.bounds.centerZ - 310 + i * 21;
    if (clear(x, z, 4)) trees.push({ x, z });
  }
  return { streets, buildings, trees, landmark: [track.bounds.centerX, 0, track.bounds.centerZ + track.bounds.depth / 2 + 95] as const };
}
