import { ITEM_LABELS, type ItemKind } from "../items/itemConfig";
import type { ItemEvent } from "../items/itemTypes";
import type { PlayerSnapshot } from "../../network/protocol";
import { NETWORK_CONFIG } from "../../network/networkConfig";

type FeedbackPlayer = Pick<PlayerSnapshot, "id" | "drifting" | "driftTier" | "turboTier" | "item" | "slipstream">;
export type DrivingFeedback = Readonly<{
  key: string; title: string; detail: string; kind: ItemKind | null;
  tone: "hit" | "defense" | "drift" | "boost" | "item";
  tier?: number; remaining?: number;
}>;
const EVENT_SECONDS = 1.25;

/** Priority is based on authoritative state, not whichever event arrived last. */
export function drivingFeedback(player: FeedbackPlayer, events: readonly ItemEvent[], tick: number,
  racers: readonly Pick<PlayerSnapshot, "id" | "nickname">[]): DrivingFeedback | null {
  const recent = events.filter(event => event.playerId === player.id && tick >= event.tick &&
    tick - event.tick < EVENT_SECONDS * NETWORK_CONFIG.simulationRateHz);
  const hit = recent.findLast(event => event.kind === "hit");
  const immune = recent.findLast(event => event.kind === "immune");
  const item = player.item;
  if (item.lockRemaining > 0) {
    const source = racers.find(racer => racer.id === hit?.sourceId)?.nickname;
    return { key: `hit-${hit?.id ?? "active"}`, title: "受到攻擊！", tone: "hit", kind: hit?.item ?? null,
      detail: hit?.item ? `${source ?? "對手"}・${ITEM_LABELS[hit.item]}` : "暫時失去操控，稍後恢復", remaining: item.lockRemaining };
  }
  if (immune) return { key: `immune-${immune.id}`, title: immune.item === "shield" ? "護盾成功抵擋！" : "恢復保護・免受攻擊",
    detail: "繼續保持路線", kind: "shield", tone: "defense" };
  if (player.drifting) return { key: `drift-${player.driftTier}`, title: player.driftTier > 0 ? `${player.driftTier} 級漂移已就緒` : "漂移充能中",
    detail: player.driftTier > 0 ? "放開漂移・出彎加速" : "保持同向轉彎累積充能", kind: null, tone: "drift", tier: player.driftTier };
  const event = recent.findLast(event => event.kind === "pickup" || event.kind === "use" || event.kind === "respawn");
  if (event) return { key: `event-${event.id}`, title: event.kind === "respawn" ? "已返回賽道" :
    `${event.kind === "pickup" ? "取得" : "發動"} ${event.item ? ITEM_LABELS[event.item] : "道具"}`,
    detail: event.kind === "respawn" ? "恢復保護中，準備出發" : event.kind === "pickup" ? "道具已放入背包" : "效果已生效",
    kind: event.item, tone: "item" };
  if (player.turboTier > 0) return { key: `turbo-${player.turboTier}`, title: `${player.turboTier} 級 Turbo！`,
    detail: "看準出彎路線", kind: "boost", tone: "boost", tier: player.turboTier };
  if (item.boostRemaining > 0 || player.slipstream.boostRemaining > 0) return { key: "boost", title: "加速推進！",
    detail: "保持路線", kind: "boost", tone: "boost", remaining: Math.max(item.boostRemaining, player.slipstream.boostRemaining) };
  if (item.immunityRemaining > 0) return { key: "recovery", title: "恢復保護中", detail: "可正常操控，暫時免受道具攻擊",
    kind: "shield", tone: "defense", remaining: item.immunityRemaining };
  if (item.shieldRemaining > 0) return { key: "shield", title: "護盾保護中", detail: "可抵擋一次攻擊",
    kind: "shield", tone: "defense", remaining: item.shieldRemaining };
  return null;
}
