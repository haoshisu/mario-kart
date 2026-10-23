import { describe, expect, it } from "vitest";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import { getCollisionResponse, getNormalImpactSpeed, resolveKartCollision } from "./CollisionSystem";

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

describe("kart separation", () => {
  const normal = { x: 1, z: 0 };
  it("rebounds both sides of a head-on collision while retaining tangential motion", () => {
    const result = resolveKartCollision({ normal, firstVelocity: { x: 10, z: 5 }, secondVelocity: { x: -10, z: 5 },
      resolvedFirstVelocity: { x: 0, z: 5 }, resolvedSecondVelocity: { x: 0, z: 5 } });
    expect(result?.impact).toBe(true);
    expect(result?.firstVelocity.x).toBe(-4);
    expect(result?.secondVelocity.x).toBe(4);
    expect(result?.firstVelocity.z).toBeCloseTo(4.4);
  });
  it("transfers a rear impact to the front kart instead of stopping both", () => {
    const result = resolveKartCollision({ normal, firstVelocity: { x: 16, z: 0 }, secondVelocity: { x: 0, z: 0 },
      resolvedFirstVelocity: { x: 8, z: 0 }, resolvedSecondVelocity: { x: 8, z: 0 } });
    expect(result?.firstVelocity.x).toBeCloseTo(4.4);
    expect(result?.secondVelocity.x).toBeCloseTo(11.6);
  });
  it("releases resting contact without treating a fast side scrape as a heavy impact", () => {
    const result = resolveKartCollision({ normal, firstVelocity: { x: .1, z: 17 }, secondVelocity: { x: 0, z: 16.9 },
      resolvedFirstVelocity: { x: 0, z: 17 }, resolvedSecondVelocity: { x: 0, z: 16.9 } });
    expect(result?.impact).toBe(false);
    expect(result?.firstVelocity).toEqual({ x: -.6, z: 17 });
    expect(result?.secondVelocity).toEqual({ x: .6, z: 16.9 });
  });
  it("does not pull an already separating pair together or react to a vertical normal", () => {
    const input = { normal, firstVelocity: { x: -2, z: 0 }, secondVelocity: { x: 2, z: 0 },
      resolvedFirstVelocity: { x: -2, z: 0 }, resolvedSecondVelocity: { x: 2, z: 0 } };
    expect(resolveKartCollision(input)).toBeNull();
    expect(resolveKartCollision({ ...input, normal: { x: 0, z: 0 } })).toBeNull();
  });
  it("gives the same result when collider order and normal orientation reverse", () => {
    const first = { x: 4, z: 3 }, second = { x: -2, z: -1 };
    const a = resolveKartCollision({ normal, firstVelocity: first, secondVelocity: second, resolvedFirstVelocity: first, resolvedSecondVelocity: second });
    const b = resolveKartCollision({ normal: { x: -1, z: 0 }, firstVelocity: second, secondVelocity: first, resolvedFirstVelocity: second, resolvedSecondVelocity: first });
    expect(a?.firstVelocity).toEqual(b?.secondVelocity);
    expect(a?.secondVelocity).toEqual(b?.firstVelocity);
  });
});
