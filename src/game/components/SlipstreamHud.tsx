import type { SlipstreamSnapshot } from "../core/kart/slipstreamSystem";

export function SlipstreamHud({ slipstream }: { slipstream: SlipstreamSnapshot }) {
  if (slipstream.charge <= 0 && !slipstream.ready && slipstream.boostRemaining <= 0) return null;
  const boosted = slipstream.boostRemaining > 0;
  const label = boosted ? "尾流超車！" : slipstream.ready ? "拉出車道・超車加速" : "跟車・蓄積尾流";
  return <div className={`slipstream-hud ${slipstream.ready ? "is-ready" : ""} ${boosted ? "is-boosting" : ""}`}
    data-testid="slipstream-hud" data-charge={slipstream.charge.toFixed(3)} data-ready={slipstream.ready} data-boost={slipstream.boostRemaining.toFixed(3)}>
    <strong>{label}</strong>
    <div className="slipstream-meter" role="progressbar" aria-label="尾流蓄力" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(slipstream.charge * 100)}>
      <span style={{ transform: `scaleX(${boosted ? 1 : slipstream.charge})` }} />
    </div>
  </div>;
}
