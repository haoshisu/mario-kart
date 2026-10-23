import { GUARD_RAIL_SEGMENTS, type GuardRailSegment } from "../../track/trackGeometry";
import type { Point2 } from "../race/raceTrack";
import { ITEM_CONFIG } from "./itemConfig";
import type { ItemRacer, ProjectileState } from "./itemTypes";

// Return the first contact along a relative motion segment, including overlap.
export function projectileContactTime(start: Point2, end: Point2, radius: number) {
  const c = start[0] ** 2 + start[1] ** 2 - radius ** 2;
  if (c <= 0) return 0;
  const dx = end[0] - start[0], dz = end[1] - start[1];
  const a = dx * dx + dz * dz;
  const b = 2 * (start[0] * dx + start[1] * dz);
  const discriminant = b * b - 4 * a * c;
  if (a === 0 || discriminant < 0) return Infinity;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : Infinity;
}

const prepareGuards = (segments: readonly GuardRailSegment[]) => segments.map((guard) => ({
  x: guard.position[0], z: guard.position[2], height: guard.position[1], halfHeight: guard.size[1] / 2 + 1,
  cos: Math.cos(guard.rotationY), sin: Math.sin(guard.rotationY),
  halfX: guard.size[0] * Math.cos(guard.rotationZ) / 2 + ITEM_CONFIG.projectileRadius,
  halfZ: guard.size[2] / 2 + ITEM_CONFIG.projectileRadius,
}));

const defaultGuards = prepareGuards(GUARD_RAIL_SEGMENTS);

export function projectileWallTime(start: Point2, end: Point2, guards = defaultGuards, height?: number) {
  let nearest = Infinity;
  for (const guard of guards) {
    if (height !== undefined && Math.abs(height - guard.height) > guard.halfHeight) continue;
    const sx = start[0] - guard.x, sz = start[1] - guard.z;
    const dx = end[0] - start[0], dz = end[1] - start[1];
    let enter = 0, leave = 1;
    for (let axis = 0; axis < 2; axis += 1) {
      const origin = axis === 0 ? guard.cos * sx - guard.sin * sz : guard.sin * sx + guard.cos * sz;
      const direction = axis === 0 ? guard.cos * dx - guard.sin * dz : guard.sin * dx + guard.cos * dz;
      const half = axis === 0 ? guard.halfX : guard.halfZ;
      if (Math.abs(direction) < 1e-9) {
        if (Math.abs(origin) > half) { enter = Infinity; break; }
      } else {
        const first = (-half - origin) / direction;
        const second = (half - origin) / direction;
        enter = Math.max(enter, Math.min(first, second));
        leave = Math.min(leave, Math.max(first, second));
      }
    }
    if (enter <= leave) nearest = Math.min(nearest, enter);
  }
  return nearest;
}

export class ProjectileSystem {
  private active: ProjectileState[] = [];
  private nextId = 0;
  private readonly guards;
  constructor(segments = GUARD_RAIL_SEGMENTS, private readonly heightAt?: (x: number, z: number, height: number) => number) { this.guards = prepareGuards(segments); }

  launch(owner: ItemRacer, kind: "disc" | "orb", racers: readonly ItemRacer[]) {
    const forward: Point2 = [-Math.sin(owner.yaw), -Math.cos(owner.yaw)];
    let targetId: string | null = null;
    let nearest: number = ITEM_CONFIG.orbTargetRange;
    if (kind === "orb") for (const racer of [...racers].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!racer.eligible || racer.id === owner.id || (racer.height !== undefined && owner.height !== undefined && Math.abs(racer.height - owner.height) > 2)) continue;
      const dx = racer.position[0] - owner.position[0], dz = racer.position[1] - owner.position[1];
      const distance = Math.hypot(dx, dz);
      if (distance > 0 && distance < nearest && (dx * forward[0] + dz * forward[1]) / distance >= ITEM_CONFIG.orbForwardCone &&
        projectileWallTime(owner.position, racer.position, this.guards, owner.height) === Infinity) {
        nearest = distance; targetId = racer.id;
      }
    }
    // Start at the kart and sweep forward, so point-blank targets and nearby
    // rails cannot be skipped by placing the muzzle beyond them.
    const position: Point2 = [owner.position[0], owner.position[1]];
    this.active.push({ id: `shot-${++this.nextId}`, ownerId: owner.id, kind, position,
      yaw: owner.yaw, height: owner.height, targetId, remaining: ITEM_CONFIG.projectileLifetime });
    if (this.active.length > ITEM_CONFIG.maximumProjectiles) this.active.shift();
  }

  step(delta: number, racers: readonly ItemRacer[], hit: (racer: ItemRacer, shot: Readonly<ProjectileState>) => void) {
    this.active = this.active.filter((shot) => {
      const elapsed = Math.min(Math.max(0, delta), shot.remaining);
      if (shot.targetId) {
        const target = racers.find((racer) => racer.id === shot.targetId && racer.eligible);
        if (!target || (target.height !== undefined && shot.height !== undefined && Math.abs(target.height - shot.height) > 2)) shot.targetId = null;
        else {
          const desired = Math.atan2(-(target.position[0] - shot.position[0]), -(target.position[1] - shot.position[1]));
          const error = Math.atan2(Math.sin(desired - shot.yaw), Math.cos(desired - shot.yaw));
          const limit = ITEM_CONFIG.orbTurnRate * elapsed;
          shot.yaw += Math.max(-limit, Math.min(limit, error));
        }
      }
      const start = shot.position;
      const end: Point2 = [start[0] - Math.sin(shot.yaw) * ITEM_CONFIG.projectileSpeed * elapsed,
        start[1] - Math.cos(shot.yaw) * ITEM_CONFIG.projectileSpeed * elapsed];
      if (shot.height !== undefined && this.heightAt) shot.height = this.heightAt(end[0], end[1], shot.height);
      let contact = projectileWallTime(start, end, this.guards, shot.height);
      let victim: ItemRacer | undefined;
      for (const racer of racers) {
        if (!racer.eligible || racer.id === shot.ownerId || (racer.height !== undefined && shot.height !== undefined && Math.abs(racer.height - shot.height) > 1.4)) continue;
        const time = projectileContactTime([start[0] - racer.previousPosition[0], start[1] - racer.previousPosition[1]],
          [end[0] - racer.position[0], end[1] - racer.position[1]], ITEM_CONFIG.projectileHitRadius);
        if (time < contact) { contact = time; victim = racer; }
      }
      shot.position = end;
      shot.remaining -= elapsed;
      if (victim) hit(victim, shot);
      return contact === Infinity && shot.remaining > 0;
    });
  }
  clearOwner(id: string) { this.active = this.active.filter((shot) => shot.ownerId !== id); }
  reset() { this.active = []; }
  snapshot() { return this.active.map((shot) => ({ ...shot, position: [shot.position[0], shot.position[1]] as const })); }
}
