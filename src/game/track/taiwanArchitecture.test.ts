import { describe, expect, it } from "vitest";
import { architecturePlacements } from "./taiwanArchitecture";
import { getTrackData } from "./trackData";
import { distanceToTrack, pointAtTrackOffset } from "./trackPath";
import { TAIWAN_TRACK_IDS } from "./taiwanTracks";

describe("Taiwan architecture clearance", () => {
  it.each(TAIWAN_TRACK_IDS)("%s leaves main and reward roads clear", id => {
    const track = getTrackData(id), placements = architecturePlacements(track, id);
    expect(placements.length).toBeGreaterThan(25);
    for (const p of placements.filter(p => !p.portal && p.scale[1] < 2 && !["tower", "crane", "ocean"].includes(p.module))) {
      // Large landmark groups use the separately validated landmark envelopes.
      if (p.radius >= 14) continue;
      for (const road of [track.samples, ...track.branches.map(b => b.samples)]) expect(distanceToTrack(p.position[0], p.position[2], road, { closed: road === track.samples })).toBeGreaterThan(p.radius + 5);
    }
    for (const p of placements.filter(p => p.portal)) {
      const sample = track.race.RACE_ROUTE_SAMPLES.reduce((best, s) => Math.hypot(s.position[0] - p.position[0], s.position[1] - p.position[2]) < Math.hypot(best.position[0] - p.position[0], best.position[1] - p.position[2]) ? s : best);
      const wall = p.module === "gate" ? 8.8 : 7;
      for (const side of [-1, 1]) for (const road of [track.samples, ...track.branches.map(b => b.samples)]) expect(distanceToTrack(...pointAtTrackOffset(sample, side * wall), road, { closed: road === track.samples })).toBeGreaterThan(5.4);
    }
  });
  it("keeps the city gate, warehouses and wooden station over actual driving routes", () => {
    expect(architecturePlacements(getTrackData("taipei"), "taipei").some(p => p.portal && p.module === "gate")).toBe(true);
    expect(architecturePlacements(getTrackData("kaohsiung"), "kaohsiung").filter(p => p.portal && p.module === "warehouse").length).toBeGreaterThan(1);
    expect(architecturePlacements(getTrackData("alishan"), "alishan").some(p => p.portal && p.module === "station")).toBe(true);
  });
});
