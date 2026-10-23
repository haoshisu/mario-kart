import { describe, expect, it } from "vitest";
import { getTrackData } from "./trackData";
import { MEADOW_PARK_SECTIONS } from "./meadowPark";
import { createTrackGeometry, railObstructsRoad } from "./trackGeometry";
import { sampleTrackSurface } from "./trackSurface";

describe("original meadow amusement park", () => {
  const track = getTrackData("meadow");
  it("gives six contiguous playable sections and a genuinely separated overpass", () => {
    expect(MEADOW_PARK_SECTIONS).toHaveLength(6);
    expect(MEADOW_PARK_SECTIONS[0].from).toBe(0);
    expect(MEADOW_PARK_SECTIONS.at(-1)?.to).toBe(1);
    MEADOW_PARK_SECTIONS.forEach((section, i) => {
      expect((section.to - section.from) * track.samples.length).toBeGreaterThan(85);
      if (i) expect(section.from).toBe(MEADOW_PARK_SECTIONS[i - 1].to);
    });
    const upper = sampleTrackSurface(0, 67.428, track.samples, undefined, { height: 16 });
    const lower = sampleTrackSurface(0, 67.428, track.samples, undefined, { height: 3 });
    expect(upper.distance).toBeLessThan(.1);
    expect(lower.distance).toBeLessThan(.1);
    expect(upper.height - lower.height).toBeGreaterThan(12);
  });
  it("opens a shorter narrow route entirely within one checkpoint interval", () => {
    expect(track.branches).toHaveLength(1);
    const branch = track.branches[0];
    expect(branch.width).toBe(6);
    expect(Math.floor(branch.entryProgress * 4)).toBe(Math.floor(branch.exitProgress * 4));
    const entry = track.race.RACE_ROUTE_SAMPLES[Math.round(track.samples.length * branch.entryProgress)];
    const exit = track.race.RACE_ROUTE_SAMPLES[Math.round(track.samples.length * branch.exitProgress)];
    expect(branch.samples[0].position).toEqual(entry.position);
    expect(branch.samples.at(-1)?.position).toEqual(exit.position);
    expect(branch.samples[0].height).toBe(entry.height);
    expect(branch.samples.at(-1)?.height).toBe(exit.height);
    const branchLength = branch.samples.reduce((sum, sample, i) => i ? sum + Math.hypot(
      sample.position[0] - branch.samples[i - 1].position[0], sample.position[1] - branch.samples[i - 1].position[1]) : 0, 0);
    expect(exit.distance - entry.distance - branchLength).toBeGreaterThan(15);
    expect(branch.geometry.ROAD_MESH_DATA.indices.length).toBe((branch.samples.length - 1) * 24);
    const lastBase = (branch.samples.length - 1) * 4;
    const indices = branch.geometry.ROAD_MESH_DATA.indices;
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = [indices[i], indices[i + 1], indices[i + 2]];
      expect(triangle.some(index => index < 4) && triangle.some(index => index >= lastBase)).toBe(false);
    }
    // Actual prism endpoints and midpoint must clear every other ribbon,
    // including a sloped merge where the centre alone would miss a conflict.
    for (const rail of branch.geometry.GUARD_RAIL_SEGMENTS) {
      expect(railObstructsRoad(rail, { samples: track.samples, width: 8.4 })).toBe(false);
    }
    for (const rail of track.geometry.GUARD_RAIL_SEGMENTS) {
      expect(railObstructsRoad(rail, { samples: branch.samples, width: branch.width, closed: false })).toBe(false);
    }
  });
  it("keeps the old low-ceiling entrance level and the downhill ribbon continuous", () => {
    const branch = track.branches[0];
    const position = [28.7478, 131.373] as const;
    const main = sampleTrackSurface(...position, track.samples);
    const shortcut = sampleTrackSurface(...position, branch.samples, undefined, { closed: false });
    expect(Math.abs(shortcut.height - main.height)).toBeLessThan(.1);
    for (let i = 1; i < branch.samples.length; i++) {
      const a = branch.samples[i - 1], b = branch.samples[i];
      const spacing = Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1]);
      expect(Math.abs(b.height - a.height) / spacing).toBeLessThan(.9);
      expect(Math.abs(b.bank)).toBeLessThan(.08);
    }
  });
  it("opens only the branch side of the main route and preserves the other courses", () => {
    const closed = createTrackGeometry(track.samples).GUARD_RAIL_SEGMENTS;
    const openings = closed.filter(rail => !track.geometry.GUARD_RAIL_SEGMENTS.some(kept => kept.position.every((value, i) => value === rail.position[i])));
    expect(openings.length).toBeGreaterThan(30);
    expect(openings.length).toBeLessThan(130);
    for (const id of ["harbor", "canyon", "aurora"] as const) {
      const other = getTrackData(id);
      expect(other.branches).toHaveLength(1);
      expect(other.geometry.GUARD_RAIL_SEGMENTS.length).toBeLessThan(other.samples.length * 2);
    }
  });
});
