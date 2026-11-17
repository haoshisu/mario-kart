import { useEffect, useRef, useState } from "react";
import type { RaceSnapshot } from "../network/protocol";
import { RACE_TENSION_CONFIG, RaceTension, type TensionCue } from "../core/feedback/raceTension";

/** Big, short-lived callouts for the final lap and overtakes. */
export function RaceTensionBanner({ snapshot, playerId }: { snapshot: RaceSnapshot | null; playerId: string | null | undefined }) {
  const tension = useRef(new RaceTension());
  const [cue, setCue] = useState<TensionCue | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    const next = tension.current.update(snapshot, playerId);
    if (next) setCue(next);
  }, [snapshot, playerId]);
  useEffect(() => {
    if (!cue) return;
    const timer = window.setTimeout(() => setCue(null),
      (cue.tone === "final" ? RACE_TENSION_CONFIG.finalLapSeconds : RACE_TENSION_CONFIG.rankSeconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [cue]);
  if (!cue) return null;
  return <div key={cue.key} className={`race-tension race-tension--${cue.tone}`} role="status" aria-live="assertive" data-testid="race-tension">
    <strong>{cue.title}</strong><small>{cue.detail}</small>
  </div>;
}
