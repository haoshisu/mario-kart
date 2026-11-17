import { describe, expect, it } from "vitest";
import { BOT_CONFIG } from "./botConfig";
import { botPaceBonus, shouldBotUseItem, type BotItemContext } from "./botTactics";

describe("CPU catch-up pacing", () => {
  it("speeds up behind the leading human and eases off far ahead", () => {
    expect(botPaceBonus(1, null, 600)).toBe(0);
    expect(botPaceBonus(1, 1.005, 600)).toBe(0);
    expect(botPaceBonus(1, 1.5, 600)).toBe(BOT_CONFIG.pace.maximumBonus);
    expect(botPaceBonus(1.5, 1, 600)).toBe(-BOT_CONFIG.pace.maximumPenalty);
    const small = botPaceBonus(1, 1 + 30 / 600, 600);
    expect(small).toBeGreaterThan(0); expect(small).toBeLessThan(BOT_CONFIG.pace.maximumBonus);
  });
});

describe("CPU item tactics", () => {
  // Yaw 0 faces -Z, so "ahead" is negative z and "behind" positive z.
  const base: BotItemContext = { kind: "disc", heldSeconds: 0, x: 0, z: 0, height: 0, yaw: 0, steer: 0,
    boosting: false, shielded: false, opponents: [] };

  it("fires straight shots only at an aligned target ahead", () => {
    expect(shouldBotUseItem({ ...base, opponents: [{ x: 0, z: -20, height: 0 }] })).toBe(true);
    expect(shouldBotUseItem({ ...base, opponents: [{ x: 8, z: -20, height: 0 }] })).toBe(false);
    expect(shouldBotUseItem({ ...base, opponents: [{ x: 0, z: 20, height: 0 }] })).toBe(false);
    expect(shouldBotUseItem({ ...base, opponents: [{ x: 0, z: -20, height: 6 }] })).toBe(false);
  });

  it("homes orbs at a target ahead within range", () => {
    expect(shouldBotUseItem({ ...base, kind: "orb", opponents: [{ x: 10, z: -25, height: 0 }] })).toBe(true);
    expect(shouldBotUseItem({ ...base, kind: "orb", opponents: [{ x: 0, z: -60, height: 0 }] })).toBe(false);
  });

  it("drops traps and raises shields for a chaser", () => {
    const chaser = [{ x: 0, z: 10, height: 0 }];
    expect(shouldBotUseItem({ ...base, kind: "trap", opponents: chaser })).toBe(true);
    expect(shouldBotUseItem({ ...base, kind: "trap" })).toBe(false);
    expect(shouldBotUseItem({ ...base, kind: "shield", opponents: chaser })).toBe(true);
    expect(shouldBotUseItem({ ...base, kind: "shield", shielded: true, opponents: chaser })).toBe(false);
  });

  it("boosts on straights and eventually spends any held item", () => {
    expect(shouldBotUseItem({ ...base, kind: "boost" })).toBe(true);
    expect(shouldBotUseItem({ ...base, kind: "boost", steer: .8 })).toBe(false);
    expect(shouldBotUseItem({ ...base, kind: "boost", boosting: true })).toBe(false);
    for (const kind of ["boost", "shield", "trap", "disc", "orb"] as const) {
      expect(shouldBotUseItem({ ...base, kind, steer: .8, heldSeconds: 20 })).toBe(true);
    }
  });
});
