import { describe, expect, it } from "vitest";
import { ITEM_KINDS, type ItemKind } from "./itemConfig";
import { itemOddsBand, rollItemKind } from "./itemOdds";

function distribution(rank: number, count: number) {
  const totals = Object.fromEntries(ITEM_KINDS.map(kind => [kind, 0])) as Record<ItemKind, number>;
  for (let i = 0; i < 1000; i++) totals[rollItemKind((i + .5) / 1000, rank, count)] += 1;
  return totals;
}

describe("placement-weighted item drops", () => {
  it("maps ranks to front, middle and back bands", () => {
    expect(itemOddsBand(1, 4)).toBe("front");
    expect(itemOddsBand(2, 4)).toBe("middle");
    expect(itemOddsBand(3, 4)).toBe("middle");
    expect(itemOddsBand(4, 4)).toBe("back");
    expect(itemOddsBand(1, 1)).toBe("middle");
    expect(itemOddsBand(2, 2)).toBe("back");
  });

  it("gives the leader defence and the last place catch-up tools", () => {
    const leader = distribution(1, 4), last = distribution(4, 4);
    expect(leader.orb).toBe(0);
    expect(leader.shield + leader.trap).toBeGreaterThan(600);
    expect(last.trap).toBe(0);
    expect(last.boost + last.orb + last.comet).toBeGreaterThan(800);
    // The leader strike only ever reaches the back of the field.
    expect(leader.comet).toBe(0);
    expect(last.comet).toBeGreaterThan(distribution(2, 4).comet);
  });

  it("keeps uniform drops when placement is unknown", () => {
    expect(ITEM_KINDS.map((_, index) => rollItemKind((index + .5) / ITEM_KINDS.length))).toEqual([...ITEM_KINDS]);
    expect(rollItemKind(1)).toBe(ITEM_KINDS.at(-1));
  });
});
