import { PracticeSplits } from "./PracticeSplits";
import type { RaceTelemetry } from "../runtime/raceRuntime";
import type { PracticeRecordView } from "../runtime/usePracticeRecord";
import { formatRaceTime } from "./RaceHud";
import styles from "./PracticeRecord.module.css";

export function PracticeRecord({ view, race, finished = false }: { view: PracticeRecordView; race: RaceTelemetry; finished?: boolean }) {
  const { best, result, unavailable } = view;
  let label = "完成三圈，建立第一筆紀錄";
  if (finished && result) {
    label = !result.previous ? "首次完成・建立紀錄" : result.newTotal ? "刷新三圈紀錄！" : result.newLap ? "刷新單圈紀錄！" : "挑戰完成";
  } else if (best) label = "挑戰本機最佳";
  return <div className={`${styles.panel} ${finished ? styles.finished : styles.target}`} data-testid={finished ? "practice-record-result" : "practice-record-target"}>
    <span className={styles.scope}>本機練習紀錄 · 三圈</span>
    <strong>{label}</strong>
    {best ? <p>最佳總時間 <b data-testid="practice-best-total">{formatRaceTime(best.bestTotal)}</b><br />
      最快單圈 <b>{formatRaceTime(best.bestLap)}</b></p> : null}
    {finished && result?.delta !== null && result?.delta !== undefined ? <p data-testid="practice-record-delta">
      {result.delta < 0 ? `比原紀錄快 ${(-result.delta).toFixed(2)} 秒` : result.delta > 0 ? `比最佳慢 ${result.delta.toFixed(2)} 秒` : "追平最佳紀錄"}
    </p> : null}
    {finished && result?.newTotal && result.newLap ? <p>同時刷新最快單圈！</p> : null}
    <PracticeSplits reference={view.reference} lapTimes={race.lapTimes} finished={finished} />
    <small>{unavailable ? "無法存取本機紀錄，本次結果不會保留。" : "僅儲存於此瀏覽器"}</small>
  </div>;
}
