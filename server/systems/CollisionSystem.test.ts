import { describe, expect, it } from "vitest";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import { getCollisionResponse, getNormalImpactSpeed } from "./CollisionSystem";

describe("authoritative collision response", () => {
  it("does not classify fast tangential scraping as a heavy head-on impact", () => {
    expect(getNormalImpactSpeed(23, 0.5, { x: 0, z: 1 })).toBe(0.5);
    expect(getNormalImpactSpeed(23, 0.5, { x: -1, z: 0 })).toBe(23);
  });
  it("slows light contacts without triggering a spin", () => {
    expect(getCollisionResponse(4)).toEqual({
      speedRetention: NETWORK_CONFIG.collision.speedRetention,
    });
  });

  it("slows heavy contacts without adding a loss-of-control effect", () => {
    expect(getCollisionResponse(NETWORK_CONFIG.collision.heavyImpactSpeed)).toEqual({
      speedRetention: NETWORK_CONFIG.collision.heavySpeedRetention,
    });
  });
});
