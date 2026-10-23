import { describe, expect, it } from "vitest";
import { TRACK_IDS } from "./trackCatalog";
import { getTrackData } from "./trackData";
import { sampleTrackSurface, roadQuaternion, surfaceOffsetHeight } from "./trackSurface";
import { pointAtTrackOffset } from "./trackPath";
import { KART_START } from "../core/kart/kartConfig";

describe.each(TRACK_IDS)("%s driveable elevation", (id) => {
  const track = getTrackData(id);
  it("has climbs, descents and a level closed starting grid", () => {
    const heights = track.samples.map((sample) => sample.height);
    expect(Math.max(...heights)).toBeGreaterThan(4);
    expect(heights[0]).toBe(0);
    expect(heights.at(-1)).toBe(0);
    const slopes = track.samples.map((sample, i) => {
      const next = track.samples[(i + 1) % track.samples.length];
      return (next.height - sample.height) / Math.hypot(next.position[0] - sample.position[0], next.position[1] - sample.position[1]);
    });
    // Long readable climbs can be gentle; requiring a 10% grade would
    // force steeper hills solely to satisfy the former compact layouts.
    expect(Math.max(...slopes)).toBeGreaterThan(.03);
    expect(Math.min(...slopes)).toBeLessThan(-.03);
    expect(Math.max(...slopes.map(Math.abs))).toBeLessThan(.55);
  });
  it("matches road vertices, banked surfaces and checkpoint respawn heights", () => {
    track.samples.forEach((sample, i) => {
      const offset = (sample.width ?? 8.4) / 2;
      const position = pointAtTrackOffset(sample, offset);
      expect(track.geometry.ROAD_MESH_DATA.vertices[i * 12 + 1]).toBeCloseTo(surfaceOffsetHeight(sample, offset) + .08, 4);
      expect(sampleTrackSurface(...position, track.samples, undefined, { height: sample.height }).height).toBeCloseTo(surfaceOffsetHeight(sample, offset), 1);
    });
    for (const marker of track.race.RACE_MARKERS) {
      expect(marker.respawn.position[1]).toBeCloseTo(sampleTrackSurface(...marker.position, track.samples, undefined, { height: marker.respawn.position[1] - KART_START.position[1] }).height + KART_START.position[1], 3);
    }
  });
  it("tilts the physical body up the slope and keeps its quaternion normalized", () => {
    for (const sample of track.samples.filter((_, i) => i % 10 === 0)) {
      const surface = sampleTrackSurface(...sample.position, track.samples, undefined, { height: sample.height });
      const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
      const q = roadQuaternion(yaw, surface);
      expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 8);
      const normal = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
      expect(normal.x / normal.y).toBeCloseTo(-surface.gradientX, 1);
      expect(normal.z / normal.y).toBeCloseTo(-surface.gradientZ, 1);
    }
  });
});
