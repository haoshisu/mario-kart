import { KART_CONFIG } from "../kart/kartConfig";

export type HorizontalVector = Readonly<{ x: number; z: number }>;

export type WallCollisionInput = Readonly<{
  velocity: HorizontalVector;
  normal: HorizontalVector;
  time: number;
  lastReactionTime: number;
}>;

export type WallCollisionResult = Readonly<{
  reacted: boolean;
  heavy: boolean;
  velocity: HorizontalVector;
  shake: number;
  reactionTime: number;
}>;

export function resolveWallCollision(input: WallCollisionInput): WallCollisionResult {
  const speed = Math.hypot(input.velocity.x, input.velocity.z);
  const normalLength = Math.hypot(input.normal.x, input.normal.z);
  const withinCooldown = input.time - input.lastReactionTime < KART_CONFIG.collision.cooldown;

  if (
    speed < KART_CONFIG.collision.minimumImpactSpeed ||
    normalLength < 0.001 ||
    withinCooldown
  ) {
    return {
      reacted: false,
      heavy: false,
      velocity: input.velocity,
      shake: 0,
      reactionTime: input.lastReactionTime,
    };
  }

  const normalX = input.normal.x / normalLength;
  const normalZ = input.normal.z / normalLength;
  const dot = input.velocity.x * normalX + input.velocity.z * normalZ;
  const reflectedX = input.velocity.x - (1 + KART_CONFIG.collision.rebound) * dot * normalX;
  const reflectedZ = input.velocity.z - (1 + KART_CONFIG.collision.rebound) * dot * normalZ;
  const retainedSpeed = speed * KART_CONFIG.collision.speedRetention;
  const reflectedLength = Math.max(0.001, Math.hypot(reflectedX, reflectedZ));
  const heavy = speed >= KART_CONFIG.collision.heavyImpactSpeed;

  return {
    reacted: true,
    heavy,
    velocity: {
      x: (reflectedX / reflectedLength) * retainedSpeed,
      z: (reflectedZ / reflectedLength) * retainedSpeed,
    },
    shake: Math.min(1, speed / KART_CONFIG.collision.heavyImpactSpeed) * (heavy ? 1 : 0.55),
    reactionTime: input.time,
  };
}
