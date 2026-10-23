import { describe, expect, it } from "vitest";
import { createCoastalWorld, jiufenHillHeight } from "./coastalWorld";
import { getTrackData } from "./trackData";
import { distanceToTrack } from "./trackPath";
import { coastalBuildingsGeometry, coastalHorizonGeometry, coastalLandGeometry, coastalLandmarksGeometry } from "../rendering/coastalWorldGeometry";

for (const id of ["jiufen", "kaohsiung"] as const) describe(`${id} complete coastal background`, () => {
  const track = getTrackData(id), world = createCoastalWorld(track, id);
  it("has deterministic populated districts outside every race ribbon", () => {
    expect(world.buildings.length).toBeGreaterThan(50);
    expect(createCoastalWorld(track, id)).toEqual(world);
    for (const b of world.buildings) for (const road of [track.samples, ...track.branches.map(b => b.samples)]) {
      expect(distanceToTrack(b.x, b.z, road, { closed: road === track.samples })).toBeGreaterThan(Math.hypot(b.width, b.depth) / 2 + 12);
    }
  });
  it.each([false, true])("keeps finite geometry and bounded background cost, low=%s", low => {
    const meshes = [coastalBuildingsGeometry(track, id, low), coastalLandGeometry(track, id), coastalLandmarksGeometry(track, id, low), coastalHorizonGeometry(track, id)];
    let triangles = 0;
    for (const geometry of meshes) {
      expect(Array.from(geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(geometry.attributes.normal.array).every(Number.isFinite)).toBe(true);
      expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      geometry.dispose();
    }
    expect(triangles).toBeLessThan(low ? 6500 : 16000);
  });
});
it("roots Jiufen houses at the shared hillside vertices", () => {
  const track = getTrackData("jiufen"), world = createCoastalWorld(track, "jiufen");
  for (const b of world.buildings) {
    if (b.hillside === false) { expect(b.y).toBe(-.15); continue; }
    const col = Math.round((b.x - world.centerX) / 32), row = Math.round((b.z - world.north - 28) / 32);
    expect(b.y).toBe(jiufenHillHeight(col, row));
  }
});
