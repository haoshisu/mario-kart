import { PracticeRecord } from "./PracticeRecord";
import type { PracticeRecordView } from "../runtime/usePracticeRecord";
import type { RaceTelemetry } from "../runtime/raceRuntime";
import { formatRaceTime } from "./RaceHud";

type FinishScreenProps = {
  race: RaceTelemetry;
  record: PracticeRecordView;
  onRestart: () => void;
};

export function FinishScreen({ race, onRestart, record }: FinishScreenProps) {
  if (race.phase !== "FINISHED") {
    return null;
  }

  return (
    <section className="finish-screen" data-testid="finish-screen">
      <p>TIME TRIAL COMPLETE</p>
      <h2>FINISH!</h2>
      <dl>
        <div><dt>TOTAL</dt><dd>{formatRaceTime(race.elapsedTime)}</dd></div>
        {race.lapTimes.map((lapTime, index) => (
          <div key={index}>
            <dt>LAP {index + 1}</dt>
            <dd>{formatRaceTime(lapTime)}</dd>
          </div>
        ))}
        <div><dt>BEST LAP</dt><dd>{formatRaceTime(race.bestLapTime ?? 0)}</dd></div>
      </dl>
      <PracticeRecord view={record} race={race} finished />
      <button onClick={onRestart} type="button">重新比賽</button>
    </section>
  );
}
