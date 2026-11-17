import { GUARD_RAIL_SEGMENTS } from "../../track/trackGeometry";
import { ProjectileSystem } from "./ProjectileSystem";
import { BOOST_PADS, ITEM_BOXES, ITEM_CONFIG, type ItemKind } from "./itemConfig";
import { createItemState, receiveItemHit, tickItemEffects } from "./ItemEffects";
import { rollItemKind } from "./itemOdds";
import type { ItemEvent, ItemEventKind, ItemRacer, ItemState, ItemWorldSnapshot, TrapState } from "./itemTypes";
import type { Point2 } from "../race/raceTrack";

export function createSeededRandom(seed: number) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x100000000;
  };
}

export function sweptDistance(point: Point2, start: Point2, end: Point2) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared));
  return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dz);
}

/** Pure authority rules. Only the server supplies eligible poses and use requests. */
export class ItemSystem {
  private readonly players = new Map<string, ItemState>();
  private readonly boxes = new Map<string, number>();
  private readonly padCooldowns = new Map<string, number>();
  private traps: TrapState[] = [];
  private readonly projectiles: ProjectileSystem;
  private events: { at: number; event: ItemEvent }[] = [];
  private random: () => number;
  private time = 0;
  private eventId = 0;
  private trapId = 0;

  constructor(seed: number, private readonly placements = { ITEM_BOXES, BOOST_PADS }, guards = GUARD_RAIL_SEGMENTS, heightAt?: (x: number, z: number, height: number) => number) {
    this.random = createSeededRandom(seed);
    this.projectiles = new ProjectileSystem(guards, heightAt);
  }

  addPlayer(id: string) { if (!this.players.has(id)) this.players.set(id, createItemState()); }
  removePlayer(id: string) {
    this.players.delete(id);
    this.projectiles.clearOwner(id);
    this.traps = this.traps.filter((trap) => trap.ownerId !== id);
    for (const key of this.padCooldowns.keys()) {
      if (key.startsWith(`${id}:`)) this.padCooldowns.delete(key);
    }
  }
  getPlayer(id: string): Readonly<ItemState> | undefined {
    const state = this.players.get(id);
    return state ? { ...state } : undefined;
  }
  protect(id: string, duration: number) {
    const state = this.players.get(id);
    if (state) state.immunityRemaining = Math.max(state.immunityRemaining, duration);
  }
  reset(seed: number) {
    this.random = createSeededRandom(seed);
    this.boxes.clear();
    this.padCooldowns.clear();
    this.traps = [];
    this.projectiles.reset();
    this.events = [];
    this.time = 0;
    // Revisions/event IDs remain monotonic across rematches to reject delayed commands/effects.
    for (const [id, state] of this.players) this.players.set(id, createItemState(state.revision + 1));
  }
  clearPlayer(id: string, tick: number, position: Point2, respawn = false) {
    const previous = this.players.get(id);
    if (!previous) return;
    const next = createItemState(previous.revision + 1);
    if (respawn) next.immunityRemaining = ITEM_CONFIG.recoverySeconds;
    this.players.set(id, next);
    this.projectiles.clearOwner(id);
    this.traps = this.traps.filter((trap) => trap.ownerId !== id);
    if (respawn) this.emit("respawn", id, id, null, position, tick);
  }
  use(racer: ItemRacer, revision: number, tick: number, racers: readonly ItemRacer[] = []) {
    const state = this.players.get(racer.id);
    if (!racer.eligible || !state || state.revision !== revision || !state.held ||
      state.cooldown > 0 || state.lockRemaining > 0) return false;
    const kind = state.held;
    state.held = state.reserve;
    state.reserve = null;
    state.revision += 1;
    state.cooldown = ITEM_CONFIG.useCooldown;
    if (kind === "disc" || kind === "orb") this.projectiles.launch(racer, kind, racers);
    if (kind === "boost") state.boostRemaining = ITEM_CONFIG.boostSeconds;
    if (kind === "shield") state.shieldRemaining = ITEM_CONFIG.shieldSeconds;
    if (kind === "trap") {
      // Positive sin/cos is behind a kart whose forward is (-sin(yaw), -cos(yaw)).
      const position: Point2 = [racer.position[0] + Math.sin(racer.yaw) * ITEM_CONFIG.trapDropDistance,
        racer.position[1] + Math.cos(racer.yaw) * ITEM_CONFIG.trapDropDistance];
      this.traps.push({ id: `trap-${++this.trapId}`, ownerId: racer.id, position, height: racer.height,
        armedAt: this.time + ITEM_CONFIG.trapArmSeconds, expiresAt: this.time + ITEM_CONFIG.trapLifetime });
      if (this.traps.length > ITEM_CONFIG.maximumTraps) this.traps.shift();
    }
    this.emit("use", racer.id, racer.id, kind, racer.position, tick);
    if (kind === "boost") this.emit("boost", racer.id, racer.id, kind, racer.position, tick);
    return true;
  }

  step(delta: number, racers: readonly ItemRacer[], tick: number) {
    this.time += Math.max(0, delta);
    for (const state of this.players.values()) tickItemEffects(state, delta);
    this.events = this.events.filter((entry) => this.time - entry.at < ITEM_CONFIG.eventLifetime);
    this.traps = this.traps.filter((trap) => trap.expiresAt > this.time);
    // Stable ordering resolves simultaneous pickups/hits deterministically.
    const eligible = racers.filter((racer) => racer.eligible).sort((a, b) => a.id.localeCompare(b.id));
    this.projectiles.step(delta, eligible, (racer, shot) => {
      const state = this.players.get(racer.id);
      if (!state) return;
      const outcome = receiveItemHit(state);
      this.emit(outcome === "hit" ? "hit" : "immune", racer.id, shot.ownerId,
        outcome === "shield" ? "shield" : shot.kind, racer.position, tick);
    });
    for (const racer of eligible) {
      const state = this.players.get(racer.id);
      if (!state) continue;
      const distance = (point: Point2) => sweptDistance(point, racer.previousPosition, racer.position);
      // Combat before pickups/pads: hits cannot be undone by a same-tick pickup or pad.
      this.traps = this.traps.filter((trap) => {
        if (trap.ownerId === racer.id || trap.armedAt > this.time || (trap.height !== undefined && racer.height !== undefined && Math.abs(trap.height - racer.height) > 1.4) || distance(trap.position) > ITEM_CONFIG.trapRadius) return true;
        const outcome = receiveItemHit(state);
        this.emit(outcome === "hit" ? "hit" : "immune", racer.id, trap.ownerId,
          outcome === "shield" ? "shield" : "trap", racer.position, tick);
        return false;
      });
      if (state.lockRemaining > 0) continue;
      for (const box of this.placements.ITEM_BOXES) {
        if ((state.held && state.reserve) || state.cooldown > 0 || (this.boxes.get(box.id) ?? 0) > this.time ||
          (racer.height !== undefined && Math.abs(racer.height - box.height) > 1.2) || distance(box.position) > ITEM_CONFIG.pickupRadius) continue;
        const kind = rollItemKind(this.random(), racer.rank, racer.racerCount);
        if (state.held) state.reserve = kind;
        else state.held = kind;
        state.revision += 1;
        this.boxes.set(box.id, this.time + ITEM_CONFIG.boxCooldown);
        this.emit("pickup", racer.id, box.id, kind, racer.position, tick);
        break;
      }
      for (const pad of this.placements.BOOST_PADS) {
        const key = `${racer.id}:${pad.id}`;
        if ((this.padCooldowns.get(key) ?? 0) > this.time || (racer.height !== undefined && Math.abs(racer.height - pad.height) > 1.2) || distance(pad.position) > ITEM_CONFIG.padRadius) continue;
        state.boostRemaining = Math.max(state.boostRemaining, ITEM_CONFIG.padBoostSeconds);
        this.padCooldowns.set(key, this.time + ITEM_CONFIG.padCooldown);
        this.emit("boost", racer.id, pad.id, "boost", racer.position, tick);
      }
    }
  }

  availableBoxes() {
    return this.placements.ITEM_BOXES.filter((box) => (this.boxes.get(box.id) ?? 0) <= this.time);
  }

  snapshot(): ItemWorldSnapshot {
    return { boxes: this.placements.ITEM_BOXES.map((box) => ({ id: box.id, remaining: Math.max(0, (this.boxes.get(box.id) ?? 0) - this.time) })),
      projectiles: this.projectiles.snapshot(),
      traps: this.traps.map((trap) => ({ ...trap })), events: this.events.map((entry) => entry.event) };
  }
  private emit(kind: ItemEventKind, playerId: string, sourceId: string, item: ItemKind | null, position: Point2, tick: number) {
    this.events.push({ at: this.time, event: { id: ++this.eventId, kind, playerId, sourceId, item, position, tick } });
    if (this.events.length > ITEM_CONFIG.maximumEvents) this.events.shift();
  }
}
