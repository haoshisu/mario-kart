import { describe, expect, it } from "vitest";
import { getTrackData } from "./trackData";
import { PLAYABLE_TRACK_IDS } from "./trackCatalog";
import { sampleDrivingSurface } from "./drivingSurface";
import { courseHandling } from "./courseDesign";
import { ROUGH_CONFIG } from "./roughZones";

describe.each(PLAYABLE_TRACK_IDS)("%s off-road apexes", id => {
  const track = getTrackData(id);
  it("marks several sharp bends and slows only the inside strip", () => {
    expect(track.roughZones.length).toBeGreaterThanOrEqual(3);
    for (const zone of track.roughZones) {
      const middle = (zone.from + zone.to) / 2;
      const sample = track.race.RACE_ROUTE_SAMPLES.reduce((best, point) => Math.abs(point.raceProgress - middle) < Math.abs(best.raceProgress - middle) ? point : best);
      const edge = (sample.width ?? 8.4) / 2;
      const at = (lateral: number) => {
        const x = sample.position[0] + -sample.tangent[1] * lateral, z = sample.position[1] + sample.tangent[0] * lateral;
        return courseHandling(id, sampleDrivingSurface(x, z, track, undefined, sample.height), true, undefined, undefined, track.roughZones);
      };
      expect(at(zone.side * (edge - .5))).toEqual(ROUGH_CONFIG.handling);
      expect(at(0)).not.toEqual(ROUGH_CONFIG.handling);
      expect(at(-zone.side * (edge - .5))).not.toEqual(ROUGH_CONFIG.handling);
    }
  });
  it("leaves every shortcut span and the start straight untouched", () => {
    for (const zone of track.roughZones) {
      expect(zone.from).toBeGreaterThan(ROUGH_CONFIG.startClearance);
      for (const branch of track.branches) expect(zone.to < branch.entryProgress || zone.from > branch.exitProgress).toBe(true);
    }
  });
});

it("keeps retired courses free of off-road apexes", () => {
  expect(getTrackData("meadow").roughZones).toEqual([]);
});
