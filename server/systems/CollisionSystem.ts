import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import type { HorizontalVector } from "../../src/game/core/collision/collisionSystem";

export type CollisionResponse = Readonly<{
  speedRetention: number;
}>;

export function getNormalImpactSpeed(x: number, z: number, normal: Readonly<{ x: number; z: number }>) {
  return Math.abs(x * normal.x + z * normal.z);
}

export function getCollisionResponse(relativeSpeed: number): CollisionResponse {
  const heavy = relativeSpeed >= NETWORK_CONFIG.collision.heavyImpactSpeed;
  return {
    speedRetention: heavy
      ? NETWORK_CONFIG.collision.heavySpeedRetention
      : NETWORK_CONFIG.collision.speedRetention,
  };
}

type KartCollisionInput = Readonly<{
  // Normal points from the first kart towards the second kart.
  normal: HorizontalVector;
  firstVelocity: HorizontalVector;
  secondVelocity: HorizontalVector;
  resolvedFirstVelocity: HorizontalVector;
  resolvedSecondVelocity: HorizontalVector;
}>;

export function resolveKartCollision(input: KartCollisionInput) {
  const length = Math.hypot(input.normal.x, input.normal.z);
  if (length < 0.2) return null;
  const nx = input.normal.x / length, nz = input.normal.z / length;
  const dot = (velocity: HorizontalVector) => velocity.x * nx + velocity.z * nz;
  const closing = dot(input.firstVelocity) - dot(input.secondVelocity);
  const impact = closing >= NETWORK_CONFIG.collision.minimumClosingSpeed;
  const separation = dot(input.resolvedSecondVelocity) - dot(input.resolvedFirstVelocity);
  const target = impact
    ? Math.min(NETWORK_CONFIG.collision.maximumSeparationSpeed,
      Math.max(NETWORK_CONFIG.collision.minimumSeparationSpeed, closing * NETWORK_CONFIG.collision.restitution))
    : NETWORK_CONFIG.collision.restingSeparationSpeed;
  // Never pull an already separating pair back together or amplify a scrape.
  if (!impact && separation >= target) return null;
  const correction = Math.max(0, target - separation) / 2;
  const retention = impact ? getCollisionResponse(closing).speedRetention : 1;
  const change = (velocity: HorizontalVector, push: number): HorizontalVector => {
    const normalSpeed = dot(velocity);
    return {
      x: (velocity.x - normalSpeed * nx) * retention + (normalSpeed + push) * nx,
      z: (velocity.z - normalSpeed * nz) * retention + (normalSpeed + push) * nz,
    };
  };
  return {
    impact,
    closingSpeed: Math.max(0, closing),
    firstVelocity: change(input.resolvedFirstVelocity, -correction),
    secondVelocity: change(input.resolvedSecondVelocity, correction),
  };
}
