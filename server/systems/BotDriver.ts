import { KART_CONFIG } from "../../src/game/core/kart/kartConfig";
import type { KartInput } from "../../src/game/core/kart/kartTypes";
import { RACE_ROUTE_SAMPLES, type RaceRouteSample } from "../../src/game/core/race/raceTrack";
import { BOT_CONFIG } from "./botConfig";

// Pure pursuit produces intent only; the ordinary Arcade/Rapier/Checkpoint pipeline owns motion.
export function botInput(x: number, z: number, yaw: number, speed: number, lane: number,
  obstacles: readonly { x: number; z: number; speed: number }[] = [], route: readonly RaceRouteSample[] = RACE_ROUTE_SAMPLES, pickups: readonly { position: readonly [number, number] }[] = []): KartInput {
  let nearest = 0;
  let distanceSquared = Infinity;
  for (let index = 0; index < route.length; index += 1) {
    const point = route[index].position;
    const distance = (point[0] - x) ** 2 + (point[1] - z) ** 2;
    if (distance < distanceSquared) { nearest = index; distanceSquared = distance; }
  }
  const current = route[nearest];
  let pickupCost = Infinity;
  const originalLane = lane;
  for (const pickup of pickups) {
    const dx = pickup.position[0] - x, dz = pickup.position[1] - z;
    const ahead = dx * current.tangent[0] + dz * current.tangent[1];
    if (ahead < 0 || ahead > 15) continue;
    const offset = (pickup.position[0] - current.position[0]) * current.normal[0] + (pickup.position[1] - current.position[1]) * current.normal[1];
    const cost = ahead + Math.abs(offset - originalLane) * 2;
    if (cost < pickupCost && Math.abs(offset) < 3) { pickupCost = cost; lane = offset; }
  }
  for (const obstacle of obstacles) {
    if (Math.abs(obstacle.speed) > BOT_CONFIG.recoverySpeed) continue;
    const forward = (obstacle.x - x) * current.tangent[0] + (obstacle.z - z) * current.tangent[1];
    const obstacleLane = (obstacle.x - current.position[0]) * current.normal[0] +
      (obstacle.z - current.position[1]) * current.normal[1];
    if (forward > -1 && forward < BOT_CONFIG.obstacleLookAhead && Math.abs(obstacleLane - lane) < BOT_CONFIG.passingClearance) {
      lane = obstacleLane < 0 ? BOT_CONFIG.passingLane : -BOT_CONFIG.passingLane;
    }
  }
  const target = route[(nearest + BOT_CONFIG.lookAheadSamples) % route.length];
  const dx = target.position[0] + target.normal[0] * lane - x;
  const dz = target.position[1] + target.normal[1] * lane - z;
  const angle = Math.atan2(-dx, -dz) - yaw;
  const error = Math.atan2(Math.sin(angle), Math.cos(angle));
  const velocity = Math.max(BOT_CONFIG.minimumSteeringSpeed, Math.abs(speed));
  const turnRate = KART_CONFIG.steeringRate * Math.min(1, velocity / KART_CONFIG.steeringFullSpeed);
  const steer = Math.abs(error) > 1 ? -Math.sign(error)
    : -2 * velocity * Math.sin(error) / (Math.max(1, Math.hypot(dx, dz)) * turnRate);
  const targetSpeed = Math.abs(error) > 0.9 ? BOT_CONFIG.recoverySpeed
    : Math.abs(error) > 0.45 ? BOT_CONFIG.cornerSpeed : BOT_CONFIG.cruiseSpeed;
  return { throttle: speed > targetSpeed ? 0 : 1, brake: speed > targetSpeed + 1 ? 1 : 0,
    steer: Math.max(-1, Math.min(1, steer)), drift: false };
}
