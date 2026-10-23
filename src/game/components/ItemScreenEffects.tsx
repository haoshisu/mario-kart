import { SpeedFlow } from "./SpeedFlow";
import type { RaceSnapshot } from "../network/protocol";
import { drivingFeedback } from "../core/feedback/drivingFeedback";
import { getDriftTierConfig } from "../core/kart/kartConfig";
import { ItemIcon } from "./ItemIcon";
import { SlipstreamHud } from "./SlipstreamHud";

export function ItemScreenEffects({ snapshot, playerId }: { snapshot: RaceSnapshot | null; playerId: string | null }) {
  const player = snapshot?.players.find(entry => entry.id === playerId);
  if (!player || snapshot?.phase !== "racing" || player.status !== "racing") return null;
  const item = player.item;
  const feedback = drivingFeedback(player, snapshot.items.events, snapshot.tick, snapshot.players);
  const boosting = item.boostRemaining > 0 || player.turboTier > 0 || player.slipstream.boostRemaining > 0;
  const shielded = item.shieldRemaining > 0;
  const hit = item.lockRemaining > 0;
  return <>
    <SlipstreamHud slipstream={player.slipstream} />
    <SpeedFlow speed={player.speed} boosting={boosting} active={player.spinOutRemaining <= 0} />
    <div className={`item-screen-effects ${boosting ? "is-boosting" : ""} ${hit ? "is-hit" : ""} ${shielded ? "is-shielded" : ""}`} aria-hidden="true" />
    {feedback ? <div key={feedback.key} className={`item-feedback-banner ${hit ? "is-hit" : ""}`} data-testid="item-feedback-banner"
      data-feedback-tone={feedback.tone} data-feedback-tier={feedback.tier ?? 0}>
      {feedback.kind ? <ItemIcon kind={feedback.kind} /> : null}
      <div className="driving-feedback-copy" role="status" aria-atomic="true">
        <strong>{feedback.title}</strong><span>{feedback.detail}</span>
      </div>
      {feedback.tone === "drift" ? <div className="driving-feedback-tiers" aria-label={`漂移等級 ${feedback.tier}`}>
        {([1, 2, 3] as const).map(tier => <i key={tier} style={{ backgroundColor: (feedback.tier ?? 0) >= tier ? getDriftTierConfig(tier)?.color : undefined }} />)}
      </div> : null}
      {feedback.remaining !== undefined ? <small aria-hidden="true">{feedback.remaining.toFixed(1)} 秒</small> : null}
    </div> : null}
  </>;
}
