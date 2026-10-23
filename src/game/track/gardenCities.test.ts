import { expect, it } from "vitest";
import { getTrackData } from "./trackData";
import { cityWorldLayout } from "./gardenCities";
import { gardenCityGeometry } from "../rendering/gardenCityGeometry";
import { distanceToTrack } from "./trackPath";
import { railObstructsRoad } from "./trackGeometry";
import { routeLength } from "./trackPlacement";

for (const id of ["tainan", "taichung"] as const) {
  const track = getTrackData(id);
  it(`${id} buildings clear every route and the background fits both budgets`, () => {
    const layout = cityWorldLayout(track, id);
    expect(layout.streets.length).toBeGreaterThan(20);
    expect(layout.buildings.length).toBeGreaterThan(50);
    for (const b of layout.buildings) for (const road of [track.samples, ...track.branches.map(b => b.samples)]) {
      expect(distanceToTrack(b.x, b.z, road, { closed: road === track.samples })).toBeGreaterThan(23);
    }
    for (const low of [false, true]) {
      const geometry = gardenCityGeometry(track, id, low);
      expect((geometry.index?.count ?? geometry.attributes.position.count) / 3).toBeLessThan(low ? 24000 : 42000);
      expect(Array.from(geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    }
  });
  it(`${id} shortcut is shorter and rail-free at merges`, () => {
    const branch = track.branches[0];
    expect(Math.floor(branch.entryProgress * 4)).toBe(Math.floor(branch.exitProgress * 4));
    expect(branch.samples.slice(1).reduce((length, p, i) => length + Math.hypot(p.position[0] - branch.samples[i].position[0], p.position[1] - branch.samples[i].position[1]), 0)).toBeLessThan((branch.exitProgress - branch.entryProgress) * routeLength(track.race.RACE_ROUTE_SAMPLES));
    for (const rail of branch.geometry.GUARD_RAIL_SEGMENTS) expect(railObstructsRoad(rail, { samples: track.samples, width: 8.4 })).toBe(false);
    for (const rail of track.geometry.GUARD_RAIL_SEGMENTS) expect(railObstructsRoad(rail, { samples: branch.samples, width: branch.width, closed: false })).toBe(false);
  });
}
