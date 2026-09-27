import type { RaceTelemetry } from "../runtime/raceRuntime";

export function formatRaceTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds - minutes * 60;
  return `${minutes}:${remaining.toFixed(2).padStart(5, "0")}`;
}

export function RaceHud({ race }: { race: RaceTelemetry }) {
  return (
    <section className="race-hud" aria-label="賽事狀態" data-testid="race-hud">
      <div>
        <span>LAP</span>
        <strong data-testid="lap-value">{race.currentLap} / {race.totalLaps}</strong>
      </div>
      <div>
        <span>TIME</span>
        <strong data-testid="race-time">{formatRaceTime(race.elapsedTime)}</strong>
      </div>
      <div>
        <span>PROGRESS</span>
        <strong data-testid="race-progress">{Math.floor(race.progressPercent)}%</strong>
      </div>
      <div className="race-hud__subline">
        <span>CP {race.checkpoint}/{race.checkpointCount}</span>
        <span>THIS {formatRaceTime(race.currentLapTime)}</span>
        {race.lastLapTime === null ? null : (
          <span>LAST {formatRaceTime(race.lastLapTime)}</span>
        )}
        {race.bestLapTime === null ? null : (
          <span>BEST {formatRaceTime(race.bestLapTime)}</span>
        )}
      </div>
    </section>
  );
}
