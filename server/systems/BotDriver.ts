import { KART_CONFIG } from "../../src/game/core/kart/kartConfig";
import { SLIPSTREAM_CONFIG } from "../../src/game/core/kart/slipstreamSystem";
import type { KartInput, DriftState } from "../../src/game/core/kart/kartTypes";
import { RACE_ROUTE_SAMPLES, type RaceRouteSample } from "../../src/game/core/race/raceTrack";
import { BOT_CONFIG } from "./botConfig";
import { TRACK_CONFIG } from "../../src/game/track/trackConfig";

// Pure pursuit produces intent only; the ordinary Arcade/Rapier/Checkpoint pipeline owns motion.
export function botInput(x: number, z: number, yaw: number, speed: number, lane: number,
  obstacles: readonly { x: number; z: number; speed: number }[] = [], route: readonly RaceRouteSample[] = RACE_ROUTE_SAMPLES, pickups: readonly { position: readonly [number, number]; height?: number }[] = [], height?: number, driftState?: DriftState,
  draftIntent?: Readonly<{ position: readonly [number, number, number] | null; ready: boolean; boosting: boolean }>): KartInput {
  let nearest = 0;
  let distanceSquared = Infinity;
  for (let index = 0; index < route.length; index += 1) {
    const point = route[index].position;
    const distance = (point[0] - x) ** 2 + (point[1] - z) ** 2 + (height === undefined ? 0 : (route[index].height - height) ** 2);
    if (distance < distanceSquared) { nearest = index; distanceSquared = distance; }
  }
  const current = route[nearest];
  let pickupCost = Infinity;
  const originalLane = lane;
  for (const pickup of pickups) {
    if (height !== undefined && pickup.height !== undefined && Math.abs(pickup.height - height) > 2) continue;
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
  if (draftIntent?.position) {
    const leadLane = (draftIntent.position[0] - current.position[0]) * current.normal[0] + (draftIntent.position[2] - current.position[1]) * current.normal[1];
    const limit = (current.width ?? TRACK_CONFIG.roadWidth) / 2 - BOT_CONFIG.draft.edgeClearance;
    lane = Math.max(-limit, Math.min(limit, leadLane + (draftIntent.ready ? (originalLane >= leadLane ? 1 : -1) * BOT_CONFIG.draft.passingOffset : 0)));
  }
  const target = route[(nearest + BOT_CONFIG.lookAheadSamples) % route.length];
  const dx = target.position[0] + target.normal[0] * lane - x;
  const dz = target.position[1] + target.normal[1] * lane - z;
  const angle = Math.atan2(-dx, -dz) - yaw;
  const error = Math.atan2(Math.sin(angle), Math.cos(angle));
  const velocity = Math.max(BOT_CONFIG.minimumSteeringSpeed, Math.abs(speed));
  const turnRate = KART_CONFIG.steeringRate * Math.min(1, velocity / KART_CONFIG.steeringFullSpeed);
  let steer = Math.abs(error) > 1 ? -Math.sign(error)
    : -2 * velocity * Math.sin(error) / (Math.max(1, Math.hypot(dx, dz)) * turnRate);
  const targetSpeed = Math.abs(error) > 0.9 ? BOT_CONFIG.recoverySpeed
    : Math.abs(error) > 0.45 ? BOT_CONFIG.cornerSpeed : draftIntent?.boosting ? SLIPSTREAM_CONFIG.boostMaximumSpeed : BOT_CONFIG.cruiseSpeed;
  const brake = speed > targetSpeed + 1 ? 1 : 0;
  const drifting = driftState !== undefined && driftState.turboRemaining === 0 && driftState.charge < KART_CONFIG.driftTiers[0].chargeTime + BOT_CONFIG.drift.releaseMargin && Math.abs(steer) <= KART_CONFIG.driftArc.inner * KART_CONFIG.driftSteeringMultiplier && brake === 0 && speed >= BOT_CONFIG.drift.minimumSpeed && Math.abs(error) < BOT_CONFIG.drift.maximumError &&
    (driftState.active ? Math.sign(steer) === driftState.direction && Math.abs(steer) >= BOT_CONFIG.drift.exitSteer : Math.abs(steer) >= BOT_CONFIG.drift.enterSteer);
  if (drifting && driftState.active) {
    // Invert the shared arc mapping to keep pursuit control over the turn radius.
    const arc = KART_CONFIG.driftArc, desired = Math.min(1, Math.abs(steer) / KART_CONFIG.driftSteeringMultiplier);
    const raw = (desired - arc.neutral) / (desired < arc.neutral ? arc.neutral - arc.outer : arc.inner - arc.neutral);
    // Commit to the inner arc while earning the first tier, then widen to pursue.
    steer = driftState.direction * (driftState.chargeTier === 0 ? Math.max(BOT_CONFIG.drift.chargeSteer, raw) : raw);
  }
  return { throttle: speed > targetSpeed ? 0 : 1, brake,
    steer: Math.max(-1, Math.min(1, steer)), drift: drifting };
}
