import { ITEM_KINDS, type ItemKind } from "./itemConfig";

/**
 * Placement-weighted drops keep the pack together: the leader mostly gets
 * defence, the back of the field gets speed and homing attacks to catch up.
 * Rows are weights for ITEM_KINDS order; each row only needs relative values.
 */
export const ITEM_ODDS: Readonly<Record<"front" | "middle" | "back", Readonly<Record<ItemKind, number>>>> = {
  front: { boost: 5, shield: 35, trap: 35, disc: 25, orb: 0 },
  middle: { boost: 20, shield: 15, trap: 20, disc: 25, orb: 20 },
  back: { boost: 45, shield: 5, trap: 0, disc: 10, orb: 40 },
};

export function itemOddsBand(rank: number, racerCount: number) {
  if (racerCount <= 1) return "middle" as const;
  const placement = (Math.min(Math.max(rank, 1), racerCount) - 1) / (racerCount - 1);
  return placement < 1 / 3 ? "front" as const : placement > 2 / 3 ? "back" as const : "middle" as const;
}

/** Without placement data every kind is equally likely, matching old replays. */
export function rollItemKind(roll: number, rank?: number, racerCount?: number): ItemKind {
  const unit = Math.min(Math.max(roll, 0), 1 - Number.EPSILON);
  if (rank === undefined || racerCount === undefined) return ITEM_KINDS[Math.floor(unit * ITEM_KINDS.length)];
  const weights = ITEM_ODDS[itemOddsBand(rank, racerCount)];
  const total = ITEM_KINDS.reduce((sum, kind) => sum + weights[kind], 0);
  let remaining = unit * total;
  for (const kind of ITEM_KINDS) {
    remaining -= weights[kind];
    if (remaining < 0) return kind;
  }
  return ITEM_KINDS.findLast(kind => weights[kind] > 0) ?? ITEM_KINDS[0];
}
