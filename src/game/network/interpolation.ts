import { applyRampSurface } from "../core/stunts/stuntSystem";
import { getKartForward } from "../core/kart/kartPhysics";
import { KART_CONFIG, KART_START } from "../core/kart/kartConfig";
import { TRACK_CONFIG } from "../track/trackConfig";
import { getTrackData } from "../track/trackData";
import { createSurfaceResult, sampleTrackSurface } from "../track/trackSurface";
import { NETWORK_CONFIG } from "./networkConfig";
import type { PlayerSnapshot, RaceSnapshot } from "./protocol";

function interpolateAngle(from: number, to: number, amount: number) {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * amount;
}

function interpolatePlayer(
  from: PlayerSnapshot,
  to: PlayerSnapshot,
  amount: number,
): PlayerSnapshot {
  const distance = Math.hypot(
    to.position[0] - from.position[0],
    to.position[1] - from.position[1],
    to.position[2] - from.position[2],
  );
  if (distance > NETWORK_CONFIG.teleportDistance) {
    return to;
  }
  const mix = (left: number, right: number) => left + (right - left) * amount;
  return {
    ...to,
    position: [
      mix(from.position[0], to.position[0]),
      mix(from.position[1], to.position[1]),
      mix(from.position[2], to.position[2]),
    ],
    yaw: interpolateAngle(from.yaw, to.yaw, amount),
    speed: mix(from.speed, to.speed),
    steer: mix(from.steer, to.steer),
    stuntProgress: from.stuntProgress > 0 && to.stuntProgress > 0 ? mix(from.stuntProgress, to.stuntProgress) : to.stuntProgress,
    spinOutRemaining: mix(from.spinOutRemaining, to.spinOutRemaining),
    raceFraction: mix(from.raceFraction, to.raceFraction),
  };
}

function interpolateSnapshots(from: RaceSnapshot, to: RaceSnapshot, amount: number): RaceSnapshot {
  const fromShots = new Map(from.items.projectiles.map((shot) => [shot.id, shot]));
  const fromPlayers = new Map(from.players.map((player) => [player.id, player]));
  return {
    ...to,
    items: { ...to.items, projectiles: to.items.projectiles.map((shot) => {
      const previous = fromShots.get(shot.id);
      return previous ? { ...shot,
        position: [previous.position[0] + (shot.position[0] - previous.position[0]) * amount,
          previous.position[1] + (shot.position[1] - previous.position[1]) * amount] as const,
        yaw: interpolateAngle(previous.yaw, shot.yaw, amount),
      } : shot;
    }) },
    serverTime: from.serverTime + (to.serverTime - from.serverTime) * amount,
    countdownRemaining:
      from.countdownRemaining + (to.countdownRemaining - from.countdownRemaining) * amount,
    elapsedTime: from.elapsedTime + (to.elapsedTime - from.elapsedTime) * amount,
    players: to.players.map((player) => {
      const previous = fromPlayers.get(player.id);
      return previous ? interpolatePlayer(previous, player, amount) : player;
    }),
  };
}

function extrapolateSnapshot(snapshot: RaceSnapshot, previous: RaceSnapshot | undefined, milliseconds: number): RaceSnapshot {
  const seconds = Math.min(milliseconds, NETWORK_CONFIG.maximumExtrapolationMs) / 1_000;
  const track = getTrackData(snapshot.trackId);
  const samples = track.samples;
  const surface = createSurfaceResult();
  const roadEdge = TRACK_CONFIG.roadWidth / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap;
  return {
    ...snapshot,
    serverTime: snapshot.serverTime + seconds * 1_000,
    elapsedTime: snapshot.elapsedTime + seconds,
    players: snapshot.players.map((player) => {
      if (player.status !== "racing" || player.spinOutRemaining > 0) {
        return player;
      }
      const forward = getKartForward(player.yaw);
      const x = player.position[0] + forward.x * player.speed * seconds;
      const z = player.position[2] + forward.z * player.speed * seconds;
      applyRampSurface(player.position[0], player.position[2], track.ramps, sampleTrackSurface(player.position[0], player.position[2], samples, surface));
      const height = surface.height;
      const onRoad = player.stuntProgress === 0 && surface.distance <= roadEdge &&
        Math.abs(player.position[1] - height - KART_START.position[1]) <= KART_CONFIG.grounding.snapDistance;
      let y = player.position[1];
      if (onRoad) {
        applyRampSurface(x, z, track.ramps, sampleTrackSurface(x, z, samples, surface));
        // Preserve the server's clearance and follow both grade and banking.
        // Never project a car leaving the road onto a remote road segment.
        if (surface.distance <= roadEdge) y += surface.height - height;
      } else if (previous?.trackId === snapshot.trackId && previous.phase === snapshot.phase) {
        const from = previous.players.find((entry) => entry.id === player.id);
        const duration = (snapshot.serverTime - previous.serverTime) / 1_000;
        if (from && duration > 0 && Math.hypot(
          player.position[0] - from.position[0], player.position[1] - from.position[1],
          player.position[2] - from.position[2],
        ) <= NETWORK_CONFIG.teleportDistance) {
          // Off-road motion follows observed falling velocity, not road height.
          y += (player.position[1] - from.position[1]) / duration * seconds;
        }
      }
      return {
        ...player,
        position: [x, y, z],
      };
    }),
  };
}

export class SnapshotBuffer {
  private snapshots: RaceSnapshot[] = [];
  private clockOffsetMs: number | null = null;
  private frame: number | null = null;
  private frameSnapshot: RaceSnapshot | null = null;

  add(snapshot: RaceSnapshot, receivedAt = Date.now()) {
    if (
      snapshot.protocolVersion !== NETWORK_CONFIG.protocolVersion ||
      snapshot.tick <= (this.snapshots.at(-1)?.tick ?? -1)
    ) {
      return false;
    }
    const measuredOffset = receivedAt - snapshot.serverTime;
    this.clockOffsetMs = this.clockOffsetMs === null
      ? measuredOffset
      : this.clockOffsetMs * 0.9 + measuredOffset * 0.1;
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 40) {
      this.snapshots.splice(0, this.snapshots.length - 40);
    }
    return true;
  }

  sample(clientTime = Date.now()): RaceSnapshot | null {
    const first = this.snapshots[0];
    const latest = this.snapshots.at(-1);
    if (!first || !latest) {
      return null;
    }
    const targetServerTime = clientTime - (this.clockOffsetMs ?? 0) -
      NETWORK_CONFIG.interpolationDelayMs;
    if (targetServerTime <= first.serverTime) {
      return first;
    }

    for (let index = 1; index < this.snapshots.length; index += 1) {
      const to = this.snapshots[index];
      if (to.serverTime >= targetServerTime) {
        const from = this.snapshots[index - 1];
        const duration = Math.max(1, to.serverTime - from.serverTime);
        return interpolateSnapshots(from, to, (targetServerTime - from.serverTime) / duration);
      }
    }
    return extrapolateSnapshot(latest, this.snapshots.at(-2), targetServerTime - latest.serverTime);
  }

  /** R3F supplies the same elapsed time to every consumer in one Canvas frame.
   * Keep camera, vehicles and effects on one sample, including its allocations.
   */
  sampleFrame(frame: number) {
    if (this.frame !== frame) {
      this.frame = frame;
      this.frameSnapshot = this.sample();
    }
    return this.frameSnapshot;
  }

  latest() {
    return this.snapshots.at(-1) ?? null;
  }

  clear() {
    this.snapshots = [];
    this.clockOffsetMs = null;
    this.frame = null;
    this.frameSnapshot = null;
  }
}
