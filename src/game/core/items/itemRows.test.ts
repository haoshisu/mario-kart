import { describe, expect, it } from "vitest";
import { getTrackData } from "../../track/trackData";
import { TRACK_IDS } from "../../track/trackCatalog";
import { routeLength } from "../../track/trackPlacement";
import { sampleTrackSurface } from "../../track/trackSurface";
import { ITEM_CONFIG } from "./itemConfig";
import { ItemSystem } from "./ItemSystem";
import type { ItemRacer } from "./itemTypes";

describe.each(TRACK_IDS)("%s full-width item supply", id => {
  const track = getTrackData(id), boxes = track.items.ITEM_BOXES;
  const rows = [...new Set(boxes.map(box => box.row))].map(row => boxes.filter(box => box.row === row));
  it("offers frequent readable rows, reaches both road edges and covers every driving line", () => {
    expect(rows.length).toBeGreaterThanOrEqual(6); expect(rows.length).toBeLessThanOrEqual(10);
    expect(new Set(boxes.map(box => box.id)).size).toBe(boxes.length);
    for (const row of rows) {
      expect(row.length).toBeGreaterThanOrEqual(4);
      const halfWidth = row[0].rowWidth / 2;
      expect(row[0].lane).toBeLessThan(-halfWidth + .8);
      expect(row.at(-1)?.lane).toBeGreaterThan(halfWidth - .8);
      for (let lane = -halfWidth + .6; lane <= halfWidth - .6; lane += .1) {
        expect(Math.min(...row.map(box => Math.abs(box.lane - lane)))).toBeLessThan(ITEM_CONFIG.pickupRadius);
      }
      for (const box of row) {
        const surface = sampleTrackSurface(...box.position, track.race.RACE_ROUTE_SAMPLES, undefined, { height: box.height });
        expect(surface.distance + .56).toBeLessThan((surface.width ?? 8.4) / 2);
        // Height-aware nearest-segment scoring can shift within a banked seam.
        expect(Math.abs(surface.height - box.height)).toBeLessThan(.01);
      }
    }
    const length = routeLength(track.race.RACE_ROUTE_SAMPLES);
    for (let i = 0; i < rows.length; i++) {
      const next = rows[(i + 1) % rows.length][0].rowDistance + (i === rows.length - 1 ? length : 0);
      const gap = next - rows[i][0].rowDistance;
      expect(gap).toBeGreaterThan(40); expect(gap).toBeLessThan(200);
    }
  });
  it("lets four side-by-side racers actually collect from one row and restores each used box", () => {
    const system = new ItemSystem(42, track.items, []), row = rows[0];
    const selected = [0, 2, row.length - 3, row.length - 1].map(index => row[index]);
    const racers: ItemRacer[] = selected.map((box, index) => {
      const id = `player-${index}`; system.addPlayer(id);
      const forwardX = -Math.sin(box.yaw), forwardZ = -Math.cos(box.yaw);
      return { id, eligible: true, yaw: box.yaw, height: box.height,
        previousPosition: [box.position[0] - forwardX * 2, box.position[1] - forwardZ * 2],
        position: [box.position[0] + forwardX * 2, box.position[1] + forwardZ * 2] };
    });
    system.step(1 / 60, racers, 1);
    expect(racers.every(racer => system.getPlayer(racer.id)?.held !== null)).toBe(true);
    const events = system.snapshot().events.filter(event => event.kind === "pickup");
    expect(events).toHaveLength(4); expect(new Set(events.map(event => event.sourceId)).size).toBe(4);
    system.step(ITEM_CONFIG.boxCooldown + .01, [], 2);
    expect(system.snapshot().boxes.every(box => box.remaining === 0)).toBe(true);
  });
});
