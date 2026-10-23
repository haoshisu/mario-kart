import { describe, expect, it } from "vitest";
import { getTrackData } from "./trackData";
import { THEME_PARK_DISTRICTS } from "./themeParks";
import { routeLength } from "./trackPlacement";
import { railObstructsRoad } from "./trackGeometry";
import { projectOntoRaceRoute } from "../core/race/progressSystem";
import { createParkObstacle, parkObstaclePose, PARK_OBSTACLE_CONFIG } from "./parkObstacle";

describe.each(["harbor", "canyon", "aurora", "forest", "clockwork", "volcano"] as const)("%s theme park", id => {
  const track = getTrackData(id), branch = track.branches[0];
  it("has contiguous districts, a shorter real branch, and common checkpoint progress", () => {
    const sections = THEME_PARK_DISTRICTS[id];
    expect(sections.length).toBeGreaterThanOrEqual(6);
    expect(sections.length).toBeLessThanOrEqual(7);
    expect(sections[0].from).toBe(0); expect(sections.at(-1)?.to).toBe(1);
    sections.forEach((section, i) => { if (i) expect(section.from).toBe(sections[i - 1].to); });
    const length = branch.samples.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.position[0] - branch.samples[i].position[0], point.position[1] - branch.samples[i].position[1]), 0);
    expect((branch.exitProgress - branch.entryProgress) * routeLength(track.race.RACE_ROUTE_SAMPLES) - length).toBeGreaterThan(8);
    expect(branch.width).toBeLessThan(8.4);
    expect(Math.floor(branch.entryProgress * 4)).toBe(Math.floor(branch.exitProgress * 4));
    let previous = branch.entryProgress;
    for (const point of branch.samples) {
      const projection = projectOntoRaceRoute(point.position, track.race, point.height);
      expect(projection.fraction).toBeGreaterThanOrEqual(previous - .003);
      previous = projection.fraction;
    }
    expect(previous).toBeCloseTo(branch.exitProgress, 2);
  });
  it("keeps merge rails clear and branch slope continuous", () => {
    for (const rail of branch.geometry.GUARD_RAIL_SEGMENTS) expect(railObstructsRoad(rail, { samples: track.samples, width: 8.4 })).toBe(false);
    for (const rail of track.geometry.GUARD_RAIL_SEGMENTS) expect(railObstructsRoad(rail, { samples: branch.samples, width: branch.width, closed: false })).toBe(false);
    for (let i = 1; i < branch.samples.length; i++) {
      const a = branch.samples[i - 1], b = branch.samples[i];
      expect(Math.abs(b.height - a.height) / Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1])).toBeLessThan(.4);
    }
    expect(track.ramps[0].launchSpeed).toBe(7.5);
  });
  it("keeps the moving obstacle in one side lane throughout its cycle", () => {
    const obstacle = createParkObstacle(track.race.RACE_ROUTE_SAMPLES, id);
    for (let t = 0; t <= PARK_OBSTACLE_CONFIG.period; t += .1) {
      const pose = parkObstaclePose(obstacle, t);
      const lateral = (pose.x - obstacle.sample.position[0]) * obstacle.sample.normal[0] + (pose.z - obstacle.sample.position[1]) * obstacle.sample.normal[1];
      expect(lateral + PARK_OBSTACLE_CONFIG.halfWidth).toBeLessThan(-.6);
      expect(Math.abs(lateral) + PARK_OBSTACLE_CONFIG.halfWidth).toBeLessThan(4.25);
    }
  });
});
