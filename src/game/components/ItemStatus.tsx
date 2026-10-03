import { ItemIcon } from "./ItemIcon";
import { ITEM_LABELS } from "../core/items/itemConfig";
import type { ItemState } from "../core/items/itemTypes";
import type { RaceSnapshot } from "../network/protocol";

export function itemEffectLabel(item: Readonly<ItemState>) {
  if (item.lockRemaining > 0) return `受擊旋轉 ${item.lockRemaining.toFixed(1)}s`;
  return [item.shieldRemaining > 0 ? `護盾 ${item.shieldRemaining.toFixed(1)}s` : "",
    item.boostRemaining > 0 ? `加速 ${item.boostRemaining.toFixed(1)}s` : "",
    item.immunityRemaining > 0 ? `恢復保護 ${item.immunityRemaining.toFixed(1)}s` : ""].filter(Boolean).join(" · ");
}

export function ItemStatus({ item, compact = false }: { item: Readonly<ItemState>; compact?: boolean }) {
  return <span className={`item-status${compact ? " item-status--compact" : ""}`} data-item={item.held ?? "none"}>
    {!compact ? <span className="item-slots" aria-label="道具背包，最多兩格">
      {[item.held, item.reserve].map((kind, index) => <span key={index} className={`item-slot item-slot--${index === 0 ? "active" : "reserve"}`} data-slot={index + 1} data-item={kind ?? "none"} aria-label={`${index === 0 ? "前格" : "備用"}：${kind ? ITEM_LABELS[kind] : "空格"}`}>
        <ItemIcon kind={kind} />
      </span>)}
    </span> : <span className="item-icons-compact"><ItemIcon kind={item.held} /><ItemIcon kind={item.reserve} /></span>}
  </span>;
}

export function ItemEventFeedback({ snapshot, playerId }: { snapshot: RaceSnapshot; playerId?: string }) {
  const events = snapshot.items.events.filter((event) => !playerId || event.playerId === playerId).slice(-3);
  return <div className="item-event-feed" aria-live="polite" aria-atomic="false">
    {events.map((event) => {
      const name = snapshot.players.find((player) => player.id === event.playerId)?.nickname ?? "玩家";
      const source = snapshot.players.find((player) => player.id === event.sourceId)?.nickname ?? "賽道";
      const item = event.item ? ITEM_LABELS[event.item] : "";
      const text = event.kind === "pickup" ? `${name} 取得 ${item}`
        : event.kind === "use" ? `${name} 使用 ${item}`
        : event.kind === "hit" ? `${name} 被 ${source} 的${item}擊中`
        : event.kind === "immune" ? `${name} ${event.item === "shield" ? "護盾抵擋" : "恢復保護"}（${source}）`
        : event.kind === "respawn" ? `${name} 已重生`
        : `${name} 加速中`;
      return <p key={event.id} data-event-kind={event.kind}>{text}</p>;
    })}
  </div>;
}
