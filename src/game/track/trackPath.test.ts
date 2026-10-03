import { describe, expect, it } from "vitest";
import { distanceToTrack as distanceToSamples } from "./trackPath";
import { TRACK_CONFIG } from "./trackConfig";
import { getTrackData } from "./trackData";
import { TRACK_IDS } from "./trackCatalog";
import { projectOntoRaceRoute as projectRoute } from "../core/race/progressSystem";
import { ITEM_CONFIG } from "../core/items/itemConfig";

const clearance = TRACK_CONFIG.roadWidth / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap;
const cross = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

describe.each(TRACK_IDS)("%s circuit", (id) => {
  const track = getTrackData(id);
  const { samples: TRACK_SAMPLES, geometry: { GUARD_RAIL_SEGMENTS }, race: { CHECKPOINTS, FINISH_MARKER }, items: { BOOST_PADS, ITEM_BOXES } } = track;
  const distanceToTrack = (x: number, z: number) => distanceToSamples(x, z, track.samples);
  const projectOntoRaceRoute = (position: readonly [number, number]) => projectRoute(position, track.race);
  it("has both left and right bends with a smooth, evenly sampled closed seam", () => {
    const turns = TRACK_SAMPLES.map((sample, i) => {
      const next = TRACK_SAMPLES[(i + 1) % TRACK_SAMPLES.length];
      const spacing = Math.hypot(next.position[0] - sample.position[0], next.position[1] - sample.position[1]);
      expect(spacing).toBeGreaterThan(.95);
      expect(spacing).toBeLessThanOrEqual(1.01);
      const angle = Math.acos(Math.min(1, sample.tangent[0] * next.tangent[0] + sample.tangent[1] * next.tangent[1]));
      // The inside road edge must never fold over at a tight control point.
      if (angle > .001) expect(spacing / angle).toBeGreaterThan(clearance + .5);
      return sample.tangent[0] * next.tangent[1] - sample.tangent[1] * next.tangent[0];
    });
    expect(turns.some((turn) => turn < -.05)).toBe(true);
    expect(turns.some((turn) => turn > .05)).toBe(true);
  });

  it("keeps both guardrails free of self intersections and opposing road sections", () => {
    const endpoints = GUARD_RAIL_SEGMENTS.map((segment) => {
      const dx = Math.cos(segment.rotationY) * (segment.size[0] - .04) * Math.cos(segment.rotationZ) / 2;
      const dz = -Math.sin(segment.rotationY) * (segment.size[0] - .04) * Math.cos(segment.rotationZ) / 2;
      return [[segment.position[0] - dx, segment.position[2] - dz], [segment.position[0] + dx, segment.position[2] + dz]];
    });
    for (let i = 0; i < endpoints.length; i += 1) {
      for (let j = i + 1; j < endpoints.length; j += 1) {
        const [a, b] = endpoints[i], [c, d] = endpoints[j];
        const intersects = cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8;
        expect(intersects, `guard ${i} intersects ${j}`).toBe(false);
      }
    }
  });

  it("aligns checkpoints and ranking fractions with the actual route", () => {
    for (const marker of [FINISH_MARKER, ...CHECKPOINTS]) {
      expect(projectOntoRaceRoute(marker.position).fraction).toBeCloseTo(marker.fraction, 5);
      expect(distanceToTrack(...marker.position)).toBeLessThan(.001);
    }
  });

  it("keeps all pickup rows and optional off-line boosts fully on the road", () => {
    for (const box of ITEM_BOXES) {
      expect(distanceToTrack(...box.position) + .5).toBeLessThan(TRACK_CONFIG.roadWidth / 2);
    }
    for (const pad of BOOST_PADS) {
      const offset = distanceToTrack(...pad.position);
      expect(offset).toBeGreaterThan(2);
      expect(offset + ITEM_CONFIG.padRadius).toBeLessThan(TRACK_CONFIG.roadWidth / 2);
    }
  });
});
