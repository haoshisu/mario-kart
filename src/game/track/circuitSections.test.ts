import { describe, expect, it } from "vitest";
import { TRACK_IDS } from "./trackCatalog";
import { createCircuitSection } from "./circuitSections";
import { getTrackData } from "./trackData";
import { sampleTrackSurface } from "./trackSurface";
import { TRACK_CONFIG } from "./trackConfig";

describe.each(TRACK_IDS)("%s landmark passage", id => {
  it("keeps both sets of supports clear of all driveable road sections", () => {
    const track = getTrackData(id);
    const section = createCircuitSection(id, track.race.RACE_ROUTE_SAMPLES, track.branches);
    for (const frame of section.frames) {
      expect(frame.position.every(Number.isFinite)).toBe(true);
      for (const side of [-1, 1]) {
        const x = frame.position[0] + Math.cos(frame.yaw) * side * 6.4;
        const z = frame.position[2] - Math.sin(frame.yaw) * side * 6.4;
        expect(sampleTrackSurface(x, z, track.samples).distance).toBeGreaterThan(TRACK_CONFIG.roadWidth / 2 + 1.4);
        for (const branch of track.branches) expect(sampleTrackSurface(x, z, branch.samples, undefined, { closed: false }).distance).toBeGreaterThan(branch.width / 2 + 1.4);
      }
    }
  });
});
