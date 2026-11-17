import { describe, expect, it } from "vitest";
import { getTrackData } from "../../track/trackData";
import { PLAYABLE_TRACK_IDS } from "../../track/trackCatalog";
import { routeLength, circularDistance } from "../../track/trackPlacement";
import { ItemSystem } from "./ItemSystem";
import { ROAD_HAZARD_CONFIG } from "./roadHazards";
import { ITEM_CONFIG } from "./itemConfig";
import type { ItemRacer } from "./itemTypes";

describe.each(PLAYABLE_TRACK_IDS)("%s road hazards", id => {
  const track = getTrackData(id), hazards = track.items.ROAD_HAZARDS;
  const route = track.race.RACE_ROUTE_SAMPLES, length = routeLength(route);
  it("places spaced slicks on one side, clear of supply rows and pads", () => {
    expect(hazards.length).toBe(ROAD_HAZARD_CONFIG.perLap);
    for (const hazard of hazards) {
      // At least half the road beside a slick stays clean.
      const nearest = route.reduce((best, point) => Math.abs(point.distance - hazard.distance) < Math.abs(best.distance - hazard.distance) ? point : best);
      expect(Math.abs(hazard.lane) + ROAD_HAZARD_CONFIG.radius).toBeLessThan((nearest.width ?? 8.4) / 2);
      expect(Math.abs(hazard.lane) - ROAD_HAZARD_CONFIG.radius).toBeGreaterThan(0);
      for (const box of track.items.ITEM_BOXES) expect(circularDistance(box.rowDistance, hazard.distance, length)).toBeGreaterThanOrEqual(ROAD_HAZARD_CONFIG.clearance);
    }
    for (let i = 1; i < hazards.length; i++) expect(hazards[i].distance - hazards[i - 1].distance).toBeGreaterThanOrEqual(ROAD_HAZARD_CONFIG.minimumSpacing);
  });
  it("spins a racer that drives across a slick, and a shield absorbs it", () => {
    const hazard = hazards[0];
    const racer: ItemRacer = { id: "a", eligible: true, yaw: 0, height: hazard.height,
      previousPosition: [hazard.position[0], hazard.position[1] + 2], position: [hazard.position[0], hazard.position[1] - 2] };
    const system = new ItemSystem(1, track.items, []);
    system.addPlayer("a");
    system.step(1 / 60, [racer], 1);
    expect(system.getPlayer("a")?.lockRemaining).toBe(ITEM_CONFIG.hitLockSeconds);
    expect(system.snapshot().events).toContainEqual(expect.objectContaining({ kind: "hit", sourceId: hazard.id, item: null }));
  });
});

it("keeps retired courses free of hazards", () => {
  expect(getTrackData("meadow").items.ROAD_HAZARDS).toEqual([]);
});

it.each(PLAYABLE_TRACK_IDS)("%s keeps slicks off every shortcut span", id => {
  const track = getTrackData(id), route = track.race.RACE_ROUTE_SAMPLES, length = routeLength(route);
  for (const hazard of track.items.ROAD_HAZARDS) {
    const progress = hazard.distance / length;
    for (const branch of track.branches) expect(progress < branch.entryProgress || progress > branch.exitProgress).toBe(true);
  }
});
