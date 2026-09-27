import { describe, expect, it } from "vitest";
import { KART_CONFIG } from "../kart/kartConfig";
import { resolveWallCollision } from "./collisionSystem";

describe("resolveWallCollision", () => {
  it("ignores low-speed wall contact", () => {
    const result = resolveWallCollision({
      velocity: { x: 1, z: 0 },
      normal: { x: -1, z: 0 },
      time: 1,
      lastReactionTime: Number.NEGATIVE_INFINITY,
    });

    expect(result.reacted).toBe(false);
    expect(result.velocity).toEqual({ x: 1, z: 0 });
  });

  it("reflects and slows a high-speed impact", () => {
    const result = resolveWallCollision({
      velocity: { x: 10, z: 0 },
      normal: { x: -1, z: 0 },
      time: 1,
      lastReactionTime: Number.NEGATIVE_INFINITY,
    });

    expect(result.reacted).toBe(true);
    expect(result.heavy).toBe(true);
    expect(result.velocity.x).toBeLessThan(0);
    expect(Math.hypot(result.velocity.x, result.velocity.z)).toBeCloseTo(
      10 * KART_CONFIG.collision.speedRetention,
      5,
    );
  });

  it("throttles repeated reactions from adjacent guard segments", () => {
    const result = resolveWallCollision({
      velocity: { x: 10, z: 0 },
      normal: { x: -1, z: 0 },
      time: 1.1,
      lastReactionTime: 1,
    });

    expect(result.reacted).toBe(false);
    expect(result.reactionTime).toBe(1);
  });

  it("classifies moderate collisions as light impacts", () => {
    const speed = (KART_CONFIG.collision.minimumImpactSpeed + KART_CONFIG.collision.heavyImpactSpeed) / 2;
    const result = resolveWallCollision({
      velocity: { x: 0, z: speed },
      normal: { x: 0, z: -1 },
      time: 2,
      lastReactionTime: Number.NEGATIVE_INFINITY,
    });

    expect(result.reacted).toBe(true);
    expect(result.heavy).toBe(false);
    expect(result.shake).toBeGreaterThan(0);
  });
});
