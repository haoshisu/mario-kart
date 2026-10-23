import RAPIER from "@dimforge/rapier3d-compat";
import { KART_START } from "../../src/game/core/kart/kartConfig";
import { SLIPSTREAM_CONFIG, stepSlipstream, slipstreamGeometry, type SlipstreamRacer } from "../../src/game/core/kart/slipstreamSystem";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import type { createSurfaceResult } from "../../src/game/track/trackSurface";
import { TRACK_CONFIG } from "../../src/game/track/trackConfig";
import type { ServerPlayerState } from "../state/roomState";

/** Reuse the road projection produced by physics rather than resampling every pair. */
export class SlipstreamSystem {
  private racers = new Map<string, SlipstreamRacer>();
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  update(player: ServerPlayerState, position: Readonly<{ x: number; y: number; z: number }>, road: ReturnType<typeof createSurfaceResult>, eligible: boolean, steer: number) {
    this.racers.set(player.id, { id: player.id, position: [position.x, position.y, position.z], yaw: player.kart.yaw,
      speed: player.kart.speed, steer, roadIndex: road.routeIndex ?? 0, roadYaw: road.yaw ?? player.kart.yaw, laneOffset: road.lateral ?? 0,
      eligible: eligible && player.stunt.active === false && road.distance < (road.width ?? TRACK_CONFIG.roadWidth) / 2 &&
        Math.abs(position.y - road.height - KART_START.position[1]) < SLIPSTREAM_CONFIG.groundTolerance });
  }
  step(world: RAPIER.World, players: Iterable<ServerPlayerState>, delta: number) {
    for (const player of players) {
      if (player.status !== "racing" || player.connection !== "connected") { this.racers.delete(player.id); continue; }
      const racer = this.racers.get(player.id);
      if (racer) stepSlipstream(player.slipstream, racer, this.racers.values(), delta, (from, to) => this.clear(world, from, to));
    }
  }
  pursuit(world: RAPIER.World, player: ServerPlayerState) {
    if (player.slipstream.boostRemaining > 0) return { position: null, ready: false, boosting: true };
    if (player.slipstream.cooldownRemaining > 0) return undefined;
    const follower = this.racers.get(player.id);
    if (!follower) return undefined;
    let target: SlipstreamRacer | null = null, closest = Infinity;
    for (const racer of this.racers.values()) {
      if (player.slipstream.readyRemaining > 0 && racer.id !== player.slipstream.targetId) continue;
      const geometry = slipstreamGeometry(follower, racer, player.slipstream.readyRemaining > 0);
      if (!geometry || geometry.gap < SLIPSTREAM_CONFIG.minimumGap || geometry.gap > SLIPSTREAM_CONFIG.maximumGap ||
        geometry.lateral > SLIPSTREAM_CONFIG.exitHalfWidth || geometry.gap >= closest || !this.clear(world, follower, racer)) continue;
      target = racer; closest = geometry.gap;
    }
    return target ? { position: target.position, ready: player.slipstream.readyRemaining > 0, boosting: false } : undefined;
  }
  clear(world: RAPIER.World, from: SlipstreamRacer, to: SlipstreamRacer) {
    this.ray.origin.x = from.position[0]; this.ray.origin.y = from.position[1]; this.ray.origin.z = from.position[2];
    this.ray.dir.x = to.position[0] - from.position[0]; this.ray.dir.y = to.position[1] - from.position[1]; this.ray.dir.z = to.position[2] - from.position[2];
    return world.castRay(this.ray, 1, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, NETWORK_CONFIG.collision.groups.roadKart) === null;
  }
  remove(id: string) { this.racers.delete(id); }
  reset() { this.racers.clear(); }
}
