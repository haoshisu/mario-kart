import { describe, expect, it } from "vitest";
import { drivingFeedback } from "./drivingFeedback";
import { createItemState } from "../items/ItemEffects";
import { createSlipstreamState, slipstreamSnapshot } from "../kart/slipstreamSystem";
import type { ItemEvent } from "../items/itemTypes";

const player = () => ({ id: "me", drifting: false, driftTier: 0 as const, turboTier: 0 as const,
  item: createItemState(), slipstream: slipstreamSnapshot(createSlipstreamState()) });
const event = (kind: ItemEvent["kind"], item: ItemEvent["item"], id = 1): ItemEvent =>
  ({ id, kind, item, tick: 100, playerId: "me", sourceId: "opponent", position: [0, 0] });
const names = [{ id: "opponent", nickname: "對手豆豆" }];

describe("driving feedback priorities", () => {
  it("keeps the actual hit source and projectile ahead of a later pickup", () => {
    const p = player(); p.item.lockRemaining = .5;
    const feedback = drivingFeedback(p, [event("hit", "disc"), event("pickup", "boost", 2)], 110, names);
    expect(feedback?.kind).toBe("disc");
    expect(feedback?.detail).toContain("對手豆豆");
    expect(feedback?.tone).toBe("hit");
  });
  it("does not invent an attack item when joining during an existing hit", () => {
    const p = player(); p.item.lockRemaining = .5;
    expect(drivingFeedback(p, [], 110, names)?.kind).toBeNull();
  });
  it("puts defense ahead of pickup and distinguishes shield from recovery", () => {
    expect(drivingFeedback(player(), [event("immune", "shield"), event("pickup", "orb", 2)], 110, names)?.title).toContain("護盾");
    expect(drivingFeedback(player(), [event("immune", null)], 110, names)?.title).toContain("恢復保護");
  });
  it.each([0, 1, 2, 3] as const)("shows drift tier %s without pickup overriding charge", tier => {
    const feedback = drivingFeedback({ ...player(), drifting: true, driftTier: tier }, [event("pickup", "orb")], 110, names);
    expect(feedback?.tone).toBe("drift"); expect(feedback?.tier).toBe(tier);
    expect(feedback?.detail).toContain(tier > 0 ? "放開" : "同向");
  });
  it("ignores expired, future and other-player events", () => {
    for (const e of [{ ...event("pickup", "orb"), tick: 10 }, { ...event("pickup", "orb"), tick: 120 },
      { ...event("pickup", "orb"), playerId: "other" }]) {
      expect(drivingFeedback(player(), [e], 110, names)).toBeNull();
    }
  });
  it("keeps the announcement identity stable while the visual countdown changes", () => {
    const p = player(); p.item.immunityRemaining = 1.5;
    const a = drivingFeedback(p, [], 110, names);
    p.item.immunityRemaining = 1.4;
    const b = drivingFeedback(p, [], 116, names);
    expect(a?.key).toBe(b?.key); expect(a?.title).toBe(b?.title);
    expect(a?.remaining).not.toBe(b?.remaining);
  });
});
