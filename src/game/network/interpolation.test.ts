import { describe, expect, it } from "vitest";
import { NETWORK_CONFIG } from "./networkConfig";
import { SnapshotBuffer } from "./interpolation";
import type { PlayerSnapshot, RaceSnapshot } from "./protocol";
import { createItemState } from "../core/items/ItemEffects";

const player = (x: number): PlayerSnapshot => ({
  item: createItemState(),
  id: "driver",
  nickname: "Driver",
  color: "coral",
  connection: "connected",
  status: "racing",
  position: [x, 0.52, 0],
  yaw: -Math.PI / 2,
  speed: 10,
  steer: 0,
  drifting: false,
  driftTier: 0,
  turboTier: 0,
  spinOutRemaining: 0,
  impactRevision: 0,
  impactKind: "kart",
  completedLaps: 0,
  totalLaps: 3,
  checkpointIndex: 0,
  raceFraction: 0,
  rank: 1,
  finishTime: null,
});

const snapshot = (tick: number, serverTime: number, x: number): RaceSnapshot => ({
  items: { boxes: [], traps: [], projectiles: [], events: [] },
  finishRemaining: null,
  protocolVersion: NETWORK_CONFIG.protocolVersion, trackId: "meadow",
  tick,
  serverTime,
  phase: "racing",
  countdownRemaining: 0,
  elapsedTime: tick / 20,
  players: [player(x)],
});

describe("SnapshotBuffer", () => {
  it("rejects repeated and stale server snapshots", () => {
    const buffer = new SnapshotBuffer();
    expect(buffer.add(snapshot(2, 1_100, 1), 1_100)).toBe(true);
    expect(buffer.add(snapshot(2, 1_101, 2), 1_101)).toBe(false);
    expect(buffer.add(snapshot(1, 1_102, 3), 1_102)).toBe(false);
  });

  it("interpolates buffered motion and caps extrapolation", () => {
    const buffer = new SnapshotBuffer();
    buffer.add(snapshot(1, 1_000, 0), 1_000);
    buffer.add(snapshot(2, 1_100, 1), 1_100);
    expect(buffer.sample(1_050 + NETWORK_CONFIG.interpolationDelayMs)?.players[0].position[0]).toBeCloseTo(0.5, 4);
    const extrapolated = buffer.sample(2_000)?.players[0].position[0] ?? 0;
    expect(extrapolated).toBeCloseTo(2, 4);
  });

  it("interpolates projectiles by identity and removes confirmed impacts", () => {
    const buffer = new SnapshotBuffer();
    const first = snapshot(1, 1000, 0), next = snapshot(2, 1100, 0);
    const shot = { id: "shot-1", kind: "disc" as const, ownerId: "driver", position: [0, 0] as const,
      yaw: 0, targetId: null, remaining: 4 };
    buffer.add({ ...first, items: { ...first.items, projectiles: [shot] } }, 1000);
    buffer.add({ ...next, items: { ...next.items, projectiles: [{ ...shot, position: [2, 0] }] } }, 1100);
    expect(buffer.sample(1050 + NETWORK_CONFIG.interpolationDelayMs)?.items.projectiles[0].position[0]).toBeCloseTo(1);
    buffer.add(snapshot(3, 1200, 0), 1200);
    expect(buffer.sample(1150 + NETWORK_CONFIG.interpolationDelayMs)?.items.projectiles).toHaveLength(0);
  });

  it("snaps across a server teleport instead of blending through barriers", () => {
    const buffer = new SnapshotBuffer();
    buffer.add(snapshot(1, 1_000, 0), 1_000);
    buffer.add(snapshot(2, 1_100, NETWORK_CONFIG.teleportDistance + 1), 1_100);
    expect(buffer.sample(1_050 + NETWORK_CONFIG.interpolationDelayMs)?.players[0].position[0]).toBe(
      NETWORK_CONFIG.teleportDistance + 1,
    );
  });
});
