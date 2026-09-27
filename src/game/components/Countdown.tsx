import type { CountdownCue } from "../core/race/raceTypes";

export function Countdown({ cue }: { cue: CountdownCue }) {
  if (!cue) {
    return null;
  }

  return (
    <div
      aria-live="assertive"
      className={`race-countdown race-countdown--${cue.toLowerCase()}`}
      data-testid="countdown-cue"
      role="status"
    >
      {cue}
    </div>
  );
}
