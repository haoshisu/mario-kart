import type { ItemKind } from "../../src/game/core/items/itemConfig";
import { ITEM_CONFIG } from "../../src/game/core/items/itemConfig";
import { BOT_CONFIG } from "./botConfig";

/**
 * Speed offset (m/s) for a CPU relative to the best human. Behind the human it
 * may exceed the ordinary top speed; far ahead it eases off. Without humans the
 * field races at its natural pace.
 */
export function botPaceBonus(botScore: number, leadingHumanScore: number | null, lapLength: number) {
  if (leadingHumanScore === null || !(lapLength > 0)) return 0;
  const { maximumBonus, fullBonusGap, maximumPenalty, fullPenaltyGap, deadZone } = BOT_CONFIG.pace;
  const gap = (leadingHumanScore - botScore) * lapLength;
  if (Math.abs(gap) <= deadZone) return 0;
  return gap > 0
    ? maximumBonus * Math.min(1, (gap - deadZone) / (fullBonusGap - deadZone))
    : -maximumPenalty * Math.min(1, (-gap - deadZone) / (fullPenaltyGap - deadZone));
}

export type BotOpponent = Readonly<{ x: number; z: number; height: number }>;
export type BotItemContext = Readonly<{
  kind: ItemKind;
  heldSeconds: number;
  x: number;
  z: number;
  height: number;
  yaw: number;
  steer: number;
  boosting: boolean;
  shielded: boolean;
  opponents: readonly BotOpponent[];
}>;

/** Use an item when it can plausibly matter; long-held items are eventually spent. */
export function shouldBotUseItem(context: BotItemContext) {
  const config = BOT_CONFIG.items;
  const forwardX = -Math.sin(context.yaw), forwardZ = -Math.cos(context.yaw);
  let ahead = Infinity, aheadAlignment = 0, behind = Infinity, behindAlignment = 0;
  for (const opponent of context.opponents) {
    if (Math.abs(opponent.height - context.height) > config.heightTolerance) continue;
    const dx = opponent.x - context.x, dz = opponent.z - context.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-3) continue;
    const alignment = (dx * forwardX + dz * forwardZ) / distance;
    if (alignment > 0 && distance < ahead) { ahead = distance; aheadAlignment = alignment; }
    if (alignment < 0 && distance < behind) { behind = distance; behindAlignment = -alignment; }
  }
  switch (context.kind) {
    case "boost":
      return !context.boosting && (Math.abs(context.steer) < config.straightSteer || context.heldSeconds > config.boostHold);
    case "shield":
      return !context.shielded && (behind < config.shieldThreatDistance || context.heldSeconds > config.shieldHold);
    case "trap":
      return (behind < config.trapThreatDistance && behindAlignment > config.trapAlignment) || context.heldSeconds > config.trapHold;
    case "disc":
      return (ahead < config.discRange && aheadAlignment > config.discAlignment) || context.heldSeconds > config.discHold;
    case "comet":
      // Always worth firing: it targets the best-placed rival wherever they are.
      return true;
    case "orb":
      return (ahead < ITEM_CONFIG.orbTargetRange && aheadAlignment >= ITEM_CONFIG.orbForwardCone) || context.heldSeconds > config.orbHold;
  }
}
