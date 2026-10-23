import { describe, expect, it } from "vitest";
import { createTaipeiWorld, taipeiRiverX, TAIPEI_WORLD } from "./taipeiWorld";
import { getTrackData } from "./trackData";
import { distanceToTrack } from "./trackPath";
import { districtGroundGeometry, basinMountainGeometry, bridgeGeometry, riverStripGeometry, worldBuildingGeometry } from "../rendering/taipeiWorldGeometry";

const track = getTrackData("taipei"), world = createTaipeiWorld(track);
describe("Taipei basin background", () => {
  it("keeps buildings clear of every drivable road and the river", () => {
    expect(world.buildings.length).toBeGreaterThan(90);
    for (const b of world.buildings) {
      const radius = Math.hypot(b.width, b.depth) / 2 + 2;
      for (const road of [track.samples, ...track.branches.map(b => b.samples)]) {
        expect(distanceToTrack(b.x, b.z, road, { closed: road === track.samples })).toBeGreaterThanOrEqual(radius + 16);
      }
      expect(Math.abs(b.x - taipeiRiverX(track, b.z))).toBeGreaterThanOrEqual(30 + radius);
    }
    expect(createTaipeiWorld(track)).toEqual(world);
  });
  it("keeps decorative bridge approaches outside the race bounds", () => {
    for (const z of world.bridges) expect(Math.abs(z - track.bounds.centerZ)).toBeGreaterThan(track.bounds.depth / 2 + 40);
    expect(TAIPEI_WORLD.mountainRadius).toBeGreaterThan(Math.hypot(track.bounds.width, track.bounds.depth));
  });
  it.each([false, true])("exports finite batched world geometry, low=%s", low => {
    const meshes = [districtGroundGeometry(track, world.buildings, low), worldBuildingGeometry(world.buildings, low), basinMountainGeometry(track), bridgeGeometry(track, world.bridges),
      riverStripGeometry(track, -22, 22, -.12), riverStripGeometry(track, -30, -22, -.08), riverStripGeometry(track, 22, 30, -.08)];
    let triangles = 0;
    for (const mesh of meshes) {
      expect(Array.from(mesh.attributes.position.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(mesh.attributes.normal.array).every(Number.isFinite)).toBe(true);
      triangles += (mesh.index?.count ?? mesh.attributes.position.count) / 3;
      mesh.dispose();
    }
    expect(triangles).toBeLessThan(low ? 6500 : 11000);
  });
});
