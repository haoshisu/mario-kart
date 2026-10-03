import { ItemScreenEffects } from "../components/ItemScreenEffects";
import { useRef } from "react";
import { ITEM_CONFIG, ITEM_LABELS } from "../core/items/itemConfig";
import { ItemIcon } from "../components/ItemIcon";
import type { RaceSnapshot } from "./protocol";

export function ControllerItemPanel({ snapshot, playerId, connected, onUse }: {
  snapshot: RaceSnapshot | null;
  playerId: string | null;
  connected: boolean;
  onUse: (revision: number) => void;
}) {
  const lastRequest = useRef({ revision: -1, sentAt: -Infinity });
  const player = snapshot?.players.find((candidate) => candidate.id === playerId);
  const item = player?.item;
  const disabled = !connected || snapshot?.phase !== "racing" || player?.status !== "racing" ||
    (player?.spinOutRemaining ?? 0) > 0 ||
    !item?.held || item.cooldown > 0 || item.lockRemaining > 0;
  return <><ItemScreenEffects snapshot={snapshot} playerId={playerId} /><section className="controller-item-panel" aria-label="道具操作" data-testid="controller-item-panel">
    <button aria-label="使用道具" className="item-slot item-slot--active controller-item-button" data-slot="1" data-item={item?.held ?? "none"} data-testid="use-item"
      aria-description={item?.held ? ITEM_LABELS[item.held] : "空格"} disabled={disabled} type="button" onClick={() => {
        if (disabled || !item) return;
        const now = performance.now();
        // A rejected request (e.g. a same-tick collision) must not lock this inventory forever.
        if (lastRequest.current.revision === item.revision &&
          now - lastRequest.current.sentAt < ITEM_CONFIG.useCooldown * 1000) return;
        lastRequest.current = { revision: item.revision, sentAt: now };
        onUse(item.revision);
      }}>
      <ItemIcon kind={item?.held ?? null} />
    </button>
    <span className="item-slot item-slot--reserve" data-slot="2" data-item={item?.reserve ?? "none"}
      aria-label={`備用：${item?.reserve ? ITEM_LABELS[item.reserve] : "空格"}`}>
      <ItemIcon kind={item?.reserve ?? null} />
    </span>
  </section></>;
}
