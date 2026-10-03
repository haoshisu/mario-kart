import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORK_CONFIG } from "./networkConfig";
import { SnapshotBuffer } from "./interpolation";
import type { PlayerSnapshot, RaceSnapshot } from "./protocol";
import { createItemState } from "../core/items/ItemEffects";
import { KART_START } from "../core/kart/kartConfig";
import { TRACK_IDS } from "../track/trackCatalog";
import { getTrackData } from "../track/trackData";
import { sampleTrackSurface } from "../track/trackSurface";

afterEach(() => vi.restoreAllMocks());

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
  spinOutRemaining: 0, stuntProgress: 0,
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

  it("snaps vertical respawns rather than blending through a raised road", () => {
    const buffer = new SnapshotBuffer();
    const first = snapshot(1, 1000, 0);
    const next: RaceSnapshot = { ...snapshot(2, 1100, 0),
      players: [{ ...player(0), position: [0, 8, 0] }] };
    buffer.add(first, 1000);
    buffer.add(next, 1100);
    expect(buffer.sample(1100)?.players[0].position[1]).toBe(8);
  });

  it.each(TRACK_IDS)("follows %s uphill, downhill and banking during bounded extrapolation", (trackId) => {
    const { samples } = getTrackData(trackId);
    for (const direction of [1, -1]) {
      const index = samples.findIndex((sample, i) => samples[(i + 1) % samples.length].height - sample.height > .05);
      expect(index).toBeGreaterThanOrEqual(0);
      const a = samples[index], b = samples[(index + 1) % samples.length];
      const dx = b.position[0] - a.position[0], dz = b.position[1] - a.position[1];
      const length = Math.hypot(dx, dz);
      const x = (a.position[0] + b.position[0]) / 2 - dz / length * 2;
      const z = (a.position[1] + b.position[1]) / 2 + dx / length * 2;
      const height = sampleTrackSurface(x, z, samples).height + KART_START.position[1];
      const buffer = new SnapshotBuffer();
      const latest = { ...snapshot(1, 1000, 0), trackId,
        players: [{ ...player(0), position: [x, height, z] as const,
          yaw: Math.atan2(-dx * direction, -dz * direction), speed: 10 }] };
      buffer.add(latest, 1000);
      const sampled = buffer.sample(1075)?.players[0];
      expect(sampled).toBeDefined();
      if (!sampled) throw new Error("Missing extrapolated player");
      expect(sampled.position[1]).toBeCloseTo(
        sampleTrackSurface(sampled.position[0], sampled.position[2], samples).height + KART_START.position[1], 8,
      );
      expect(Math.sign(sampled.position[1] - height)).toBe(direction);
      const capped = buffer.sample(5000)?.players[0];
      expect(capped?.position).toEqual(buffer.sample(1150)?.players[0].position);
    }
  });

  it("preserves observed off-road falling motion and freezes finished cars", () => {
    const buffer = new SnapshotBuffer();
    const first: RaceSnapshot = { ...snapshot(1, 1000, 200),
      players: [{ ...player(200), position: [200, 8, 200] }] };
    const next: RaceSnapshot = { ...snapshot(2, 1100, 201),
      players: [{ ...player(201), position: [201, 7, 200] }] };
    buffer.add(first, 1000);
    buffer.add(next, 1100);
    expect(buffer.sample(1250)?.players[0].position).toEqual([202, 6, 200]);
    buffer.add({ ...next, tick: 3, serverTime: 1200,
      players: [{ ...next.players[0], status: "finished" }] }, 1200);
    expect(buffer.sample(1350)?.players[0].position).toEqual(next.players[0].position);
  });

  it("does not infer falling velocity from a teleport or a previous course", () => {
    for (const [trackId, previousHeight] of [["meadow", 20], ["canyon", 8]] as const) {
      const buffer = new SnapshotBuffer();
      buffer.add({ ...snapshot(1, 1000, 200), trackId,
        players: [{ ...player(200), position: [200, previousHeight, 200] }] }, 1000);
      buffer.add({ ...snapshot(2, 1100, 200),
        players: [{ ...player(200), position: [200, 7, 200] }] }, 1100);
      expect(buffer.sample(1250)?.players[0].position[1]).toBe(7);
    }
  });

  it("shares one immutable sample across frame consumers and clears it on reconnect", () => {
    const buffer = new SnapshotBuffer();
    vi.spyOn(Date, "now").mockReturnValue(1100);
    buffer.add(snapshot(1, 1000, 0), 1000);
    const sample = vi.spyOn(buffer, "sample");
    const frame = buffer.sampleFrame(1);
    for (let i = 0; i < 10; i += 1) expect(buffer.sampleFrame(1)).toBe(frame);
    // Newly received data must not split the camera and cars within one frame.
    buffer.add(snapshot(2, 1100, 1), 1100);
    expect(buffer.sampleFrame(1)).toBe(frame);
    expect(sample).toHaveBeenCalledTimes(1);
    expect(buffer.sampleFrame(2)).not.toBe(frame);
    expect(sample).toHaveBeenCalledTimes(2);
    buffer.clear();
    expect(buffer.sampleFrame(2)).toBeNull();
  });
});
