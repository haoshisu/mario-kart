import { describe, expect, it } from "vitest";
import { ProjectileSystem, projectileContactTime, projectileWallTime } from "./ProjectileSystem";
import { ITEM_CONFIG } from "./itemConfig";
import type { ItemRacer } from "./itemTypes";

const racer = (id: string, x: number, z = -10.5, yaw = -Math.PI / 2): ItemRacer => ({
  id, position: [x, z], previousPosition: [x, z], yaw, eligible: true,
});

describe("authoritative projectiles", () => {
  it("sweeps moving targets and hits the first car only, ignoring the owner", () => {
    const shots = new ProjectileSystem();
    const owner = racer("owner", -10);
    shots.launch(owner, "disc", []);
    const hits: string[] = [];
    shots.step(0.5, [racer("far", 2), owner, racer("near", -4)], (target) => hits.push(target.id));
    expect(hits).toEqual(["near"]);
    expect(shots.snapshot()).toHaveLength(0);
    expect(projectileContactTime([-4, 0], [4, 0], 1)).toBeCloseTo(0.375);
    expect(projectileContactTime([-4, 2], [4, 2], 1)).toBe(Infinity);
  });
  it("stops at a guard rail before hitting a car behind it, including muzzle obstruction", () => {
    const owner = racer("owner", 0, -10.5, 0);
    expect(projectileWallTime(owner.position, [0, -30])).toBeLessThan(1);
    const shots = new ProjectileSystem();
    shots.launch(owner, "disc", []);
    let hits = 0;
    shots.step(1, [racer("outside", 0, -25)], () => hits++);
    expect(hits).toBe(0);
    expect(shots.snapshot()).toHaveLength(0);
  });
  it("locks onto the nearest visible forward opponent and limits turning", () => {
    const shots = new ProjectileSystem();
    const owner = racer("owner", -10);
    const target = racer("near", 0, -9);
    shots.launch(owner, "orb", [racer("behind", -12), racer("far", 10), target]);
    expect(shots.snapshot()[0].targetId).toBe("near");
    const initial = shots.snapshot()[0].yaw;
    shots.step(1 / 60, [target], () => undefined);
    expect(shots.snapshot()[0].yaw).not.toBe(initial);
    expect(Math.abs(shots.snapshot()[0].yaw - initial)).toBeLessThanOrEqual(ITEM_CONFIG.orbTurnRate / 60 + 1e-12);
    shots.step(1 / 60, [{ ...target, eligible: false }], () => undefined);
    expect(shots.snapshot()[0].targetId).toBeNull();
  });
  it("fires straight without a target, expires, caps active shots and cleans owners/rematches", () => {
    const shots = new ProjectileSystem();
    const owner = racer("owner", -10);
    for (let i = 0; i < ITEM_CONFIG.maximumProjectiles + 3; i++) shots.launch(owner, "orb", []);
    expect(shots.snapshot()).toHaveLength(ITEM_CONFIG.maximumProjectiles);
    expect(shots.snapshot()[0].targetId).toBeNull();
    shots.step(0.01, [], () => undefined);
    expect(shots.snapshot()[0].yaw).toBe(owner.yaw);
    shots.clearOwner("owner");
    expect(shots.snapshot()).toHaveLength(0);
    shots.launch(owner, "disc", []);
    shots.step(ITEM_CONFIG.projectileLifetime + 1, [], () => undefined);
    expect(shots.snapshot()).toHaveLength(0);
    shots.launch(owner, "disc", []);
    shots.reset();
    expect(shots.snapshot()).toHaveLength(0);
  });
});
