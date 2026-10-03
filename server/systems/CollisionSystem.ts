import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";

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
