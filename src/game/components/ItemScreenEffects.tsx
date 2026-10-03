import type { RaceSnapshot } from "../network/protocol";
import { ITEM_LABELS } from "../core/items/itemConfig";
import { ItemIcon } from "./ItemIcon";

export function ItemScreenEffects({ snapshot, playerId }: { snapshot: RaceSnapshot | null; playerId: string | null }) {
  const player = snapshot?.players.find((entry) => entry.id === playerId);
  if (!player || snapshot?.phase !== "racing") return null;
  const item = player.item;
  const event = snapshot.items.events.filter((entry) => entry.playerId === playerId &&
    snapshot.tick - entry.tick < 75 && entry.kind !== "boost").at(-1);
  const boosting = item.boostRemaining > 0;
  const shielded = item.shieldRemaining > 0;
  const hit = item.lockRemaining > 0;
  const label = hit ? "受到攻擊！" : event?.kind === "immune" ? "成功抵擋！"
    : event?.kind === "pickup" ? `取得 ${event.item ? ITEM_LABELS[event.item] : "道具"}`
    : event?.kind === "use" ? `${event.item ? ITEM_LABELS[event.item] : "道具"}・發動！`
    : boosting ? "極速推進！" : shielded ? "護盾保護中" : "";
  const kind = hit ? "trap" : event?.item ?? (boosting ? "boost" : shielded ? "shield" : null);
  return <>
    <div className={`item-screen-effects ${boosting ? "is-boosting" : ""} ${hit ? "is-hit" : ""} ${shielded ? "is-shielded" : ""}`} aria-hidden="true" />
    {label ? <div key={`${event?.id ?? label}`} className={`item-feedback-banner ${hit ? "is-hit" : ""}`} data-testid="item-feedback-banner" role="status">
      <ItemIcon kind={kind} /><strong>{label}</strong>
      {boosting || shielded ? <small>{(boosting ? item.boostRemaining : item.shieldRemaining).toFixed(1)} 秒</small> : null}
    </div> : null}
  </>;
}
