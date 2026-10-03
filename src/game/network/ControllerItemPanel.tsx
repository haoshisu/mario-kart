import { ItemScreenEffects } from "../components/ItemScreenEffects";
import { useRef } from "react";
import { ITEM_CONFIG, ITEM_LABELS, ITEM_DESCRIPTIONS } from "../core/items/itemConfig";
import { ItemEventFeedback, ItemStatus } from "../components/ItemStatus";
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
    <div>
      {item ? <ItemStatus item={item} /> : <span>等待道具狀態</span>}
      {snapshot?.phase === "racing" && snapshot.finishRemaining !== null ?
        <small>{player?.status === "finished" ? "已完賽，等待其他玩家" : `剩餘 ${Math.ceil(snapshot.finishRemaining)} 秒`}</small> : null}
      {snapshot && playerId ? <ItemEventFeedback snapshot={snapshot} playerId={playerId} /> : null}
    </div>
    <button aria-label="使用道具" className="controller-item-button" data-testid="use-item"
      title={item?.held ? ITEM_DESCRIPTIONS[item.held] : "駛過道具箱取得"} disabled={disabled} type="button" onClick={() => {
        if (disabled || !item) return;
        const now = performance.now();
        // A rejected request (e.g. a same-tick collision) must not lock this inventory forever.
        if (lastRequest.current.revision === item.revision &&
          now - lastRequest.current.sentAt < ITEM_CONFIG.useCooldown * 1000) return;
        lastRequest.current = { revision: item.revision, sentAt: now };
        onUse(item.revision);
      }}>
      <strong>使用道具</strong><small>{item?.held ? ITEM_LABELS[item.held] : "駛過道具箱取得"}</small>
    </button>
  </section></>;
}
