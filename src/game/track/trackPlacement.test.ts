import { describe, expect, it } from "vitest";
import { TRACK_IDS } from "./trackCatalog";
import { getTrackData } from "./trackData";
import { circularDistance, evaluateJumpRunway, routeLength, sampleAtDistance, RUNWAY_CONFIG } from "./trackPlacement";
import { createJumpRamps, STUNT_CONFIG, applyRampSurface } from "../core/stunts/stuntSystem";
import { ITEM_CONFIG } from "../core/items/itemConfig";
import { sampleTrackSurface } from "./trackSurface";

describe("authored optional reward lanes", () => {
  it.each(TRACK_IDS)("%s has safe full-speed landings, recovery and cooldown spacing", id => {
    const track = getTrackData(id), route = track.race.RACE_ROUTE_SAMPLES;
    const length = routeLength(route);
    const locations = track.ramps.map(ramp => {
      const point = route.reduce((best, sample) => Math.hypot(sample.position[0] - ramp.position[0], sample.position[1] - ramp.position[1]) <
        Math.hypot(best.position[0] - ramp.position[0], best.position[1] - ramp.position[1]) ? sample : best);
      const lane = (ramp.position[0] - point.position[0]) * point.normal[0] + (ramp.position[1] - point.position[1]) * point.normal[1];
      expect(Math.abs(lane)).toBeCloseTo(2, 1);
      expect(point.raceProgress).toBeGreaterThanOrEqual(.12);
      const ground = sampleTrackSurface(...point.position, route);
      const bypass = applyRampSurface(...point.position, [ramp], { ...ground });
      expect(bypass.height).toBe(ground.height);
      const runway = evaluateJumpRunway(route, point, lane, STUNT_CONFIG.rise, ramp.launchSpeed ?? STUNT_CONFIG.launchSpeed);
      expect(runway).toBeDefined();
      return { point, flight: runway?.maximumFlightSeconds ?? Infinity };
    });
    for (const a of locations) for (const b of locations) {
      if (a === b) continue;
      expect(circularDistance(a.point.distance, b.point.distance, length)).toBeGreaterThanOrEqual(23 * (Math.max(a.flight, b.flight) + STUNT_CONFIG.cooldown));
    }
    // Reproduce the ballistic touchdown in world coordinates; a safe landing
    // must not automatically collect the ground lane's item reward.
    for (const ramp of track.ramps) for (const speed of RUNWAY_CONFIG.speeds) {
      let landed = false;
      for (let t = RUNWAY_CONFIG.step; t <= RUNWAY_CONFIG.maximumFlight; t += RUNWAY_CONFIG.step) {
        const x = ramp.position[0] + ramp.forward[0] * speed * t;
        const z = ramp.position[1] + ramp.forward[1] * speed * t;
        const launchSpeed = ramp.launchSpeed ?? STUNT_CONFIG.launchSpeed;
        const height = ramp.height + STUNT_CONFIG.rise + launchSpeed * t - RUNWAY_CONFIG.gravity * t * t / 2;
        const surface = sampleTrackSurface(x, z, route, undefined, { height });
        if (t < launchSpeed / RUNWAY_CONFIG.gravity || height > surface.height) continue;
        for (const box of track.items.ITEM_BOXES) {
          expect(Math.hypot(box.position[0] - x, box.position[1] - z), `${ramp.id}, ${speed}m/s, ${box.id}`)
            .toBeGreaterThan(ITEM_CONFIG.pickupRadius);
        }
        landed = true;
        break;
      }
      expect(landed, `${ramp.id}, ${speed}m/s`).toBe(true);
    }
    expect(track.items.BOOST_PADS.filter(pad=>!pad.id.startsWith("bridge-pad"))).toHaveLength(8);
    const chain = [1, 6, 7].map(index => track.items.BOOST_PADS[index]);
    for (let i = 1; i < chain.length; i++) {
      const distance = Math.hypot(chain[i].position[0] - chain[i-1].position[0], chain[i].position[1] - chain[i-1].position[1]);
      expect(distance).toBeGreaterThan(6);
      expect(distance).toBeLessThan(12);
    }
    expect(sampleAtDistance(route, length).distance).toBe(0);
  });
  it("rejects a road with no runway instead of placing a jump at the start", () => {
    const route = getTrackData("meadow").race.RACE_ROUTE_SAMPLES.filter(sample => sample.raceProgress < .1);
    expect(() => createJumpRamps("meadow", route)).toThrow("no safe");
  });
});
