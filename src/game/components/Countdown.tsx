import type { CountdownCue } from "../core/race/raceTypes";

export function countdownCue(remaining: number, racing = false, elapsed = 2): CountdownCue {
  if (racing) return elapsed < 1.1 ? "GO" : null;
  return remaining > 0 ? remaining > 2 ? "3" : remaining > 1 ? "2" : "1" : null;
}

/** Original propeller firefly referee, shared by every racing screen. */
export function Countdown({ cue }: { cue: CountdownCue }) {
  if (!cue) return null;
  const lit = cue === "GO" ? 3 : 4 - Number(cue);
  return <div className={`start-referee ${cue === "GO" ? "start-referee--go" : ""}`} role="status" aria-live="assertive" aria-label={`起跑燈號 ${cue}`}>
    <svg className="start-referee-pilot" viewBox="0 0 180 110" aria-hidden="true">
      <ellipse cx="90" cy="15" rx="45" ry="5" fill="#8cf5ec" />
      <path d="M90 16v18" stroke="#f6cf65" strokeWidth="6" />
      <ellipse cx="49" cy="63" rx="28" ry="14" fill="#b2f5fa" transform="rotate(-25 49 63)" />
      <ellipse cx="131" cy="63" rx="28" ry="14" fill="#b2f5fa" transform="rotate(25 131 63)" />
      <rect x="59" y="30" width="62" height="61" rx="27" fill="#ffc95f" stroke="#674539" strokeWidth="3" />
      <rect x="66" y="44" width="48" height="27" rx="12" fill="#243f58" />
      <path d="M76 56v6m27-6v6" stroke="#a4fff0" strokeWidth="5" strokeLinecap="round" />
      <path d="M81 78q9 7 18 0M66 87l-9 19m57-19 9 19" fill="none" stroke="#674539" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <div className="start-light-board" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} className={`start-lamp ${i < lit ? "start-lamp--lit" : ""}`} />)}</div>
    <strong data-testid="countdown-cue">{cue}</strong>
    <small>{cue === "GO" ? "噴射起跑！" : "準備起跑"}</small>
  </div>;
}
