import { getKartForward } from "../core/kart/kartPhysics";
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

function extrapolateSnapshot(snapshot: RaceSnapshot, milliseconds: number): RaceSnapshot {
  const seconds = Math.min(milliseconds, NETWORK_CONFIG.maximumExtrapolationMs) / 1_000;
  return {
    ...snapshot,
    serverTime: snapshot.serverTime + seconds * 1_000,
    elapsedTime: snapshot.elapsedTime + seconds,
    players: snapshot.players.map((player) => {
      if (player.status !== "racing" || player.spinOutRemaining > 0) {
        return player;
      }
      const forward = getKartForward(player.yaw);
      return {
        ...player,
        position: [
          player.position[0] + forward.x * player.speed * seconds,
          player.position[1],
          player.position[2] + forward.z * player.speed * seconds,
        ],
      };
    }),
  };
}

export class SnapshotBuffer {
  private snapshots: RaceSnapshot[] = [];
  private clockOffsetMs: number | null = null;

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
    return extrapolateSnapshot(latest, targetServerTime - latest.serverTime);
  }

  latest() {
    return this.snapshots.at(-1) ?? null;
  }

  clear() {
    this.snapshots = [];
    this.clockOffsetMs = null;
  }
}
