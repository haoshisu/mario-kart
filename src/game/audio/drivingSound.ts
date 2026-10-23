import type { DriftTier } from "../core/kart/kartConfig";
import type { RaceSound } from "./raceSoundCues";
import type { SlipstreamSnapshot } from "../core/kart/slipstreamSystem";

export function drivingMix(speed: number, drifting: boolean, boosting: boolean, active: boolean, draftCharge = 0) {
  const velocity = active && Number.isFinite(speed) ? Math.min(23, Math.abs(speed)) : 0;
  const weight = velocity / 23;
  const draft = active && Number.isFinite(draftCharge) ? Math.max(0, Math.min(1, draftCharge)) : 0;
  return { frequency: 55 + 120 * weight + (boosting ? 18 : 0) + draft * 4,
    engine: active ? .08 + .14 * weight : 0, wind: .17 * weight * weight + .1 * draft,
    tires: drifting && velocity > 5 ? .13 * weight : 0 };
}

/** Edges belong to the followed car, not every remote player's effects. */
export class DrivingSoundCues {
  private tier: DriftTier = 0;
  private boosting = false;
  private draftReady = false;
  private draftRevision: number | null = null;
  collect(tier: DriftTier, boosting: boolean, active: boolean, draft?: SlipstreamSnapshot): RaceSound[] {
    const sounds: RaceSound[] = [];
    if (active && tier > this.tier) sounds.push((["drift1", "drift2", "drift3"] as const)[tier - 1]);
    const draftBoosted = active && this.draftRevision !== null && (draft?.boostRevision ?? 0) > this.draftRevision;
    if (active && draft?.ready && !this.draftReady) sounds.push("draftReady");
    if (draftBoosted) sounds.push("draftBoost");
    else if (active && boosting && !this.boosting) sounds.push("boost");
    this.tier = active ? tier : 0;
    this.boosting = active && boosting;
    this.draftReady = active && (draft?.ready ?? false);
    this.draftRevision = active ? draft?.boostRevision ?? null : null;
    return sounds;
  }
}
