import { comparePracticeSplits, formatPracticeDelta } from "../core/race/practiceSplits";
import type { PracticeRecord } from "../core/race/practiceRecords";
import { formatRaceTime } from "./RaceHud";
import styles from "./PracticeSplits.module.css";

export function PracticeSplits({ reference, lapTimes, finished }: {
  reference: PracticeRecord | null; lapTimes: readonly number[]; finished: boolean;
}) {
  if (!reference) return null;
  if (!reference.bestRunLaps) return <p className={styles.hint}>{finished ? "此場起跑前尚無逐圈資料。" : "刷新或追平總時間，建立逐圈對照。"}</p>;
  const splits = comparePracticeSplits(reference, lapTimes);
  const last = splits.at(-1);
  const nextTarget = reference.bestRunLaps[lapTimes.length];
  return <section className={styles.splits} data-testid="practice-splits" aria-label="逐圈成績對照">
    <p className={styles.hint}>對照本場開始時最佳場次</p>
    {finished ? <table>
      <thead><tr><th scope="col">圈</th><th scope="col">本圈差</th><th scope="col">累計差</th></tr></thead>
      <tbody>{splits.map(split => <tr key={split.lap} data-testid={`practice-split-${split.lap}`}>
        <th scope="row">{split.lap}</th>
        <td data-trend={Math.sign(split.lapDelta)}>{formatPracticeDelta(split.lapDelta)}</td>
        <td data-trend={Math.sign(split.cumulativeDelta)}>{formatPracticeDelta(split.cumulativeDelta)}</td>
      </tr>)}</tbody>
    </table> : <>
      <div role="status" aria-live="polite" aria-atomic="true">
        {last ? <p data-testid="practice-live-split" data-trend={Math.sign(last.cumulativeDelta)}>
          第 {last.lap} 圈完成 · 累計{formatPracticeDelta(last.cumulativeDelta)}
        </p> : null}
      </div>
      {nextTarget !== undefined ? <p data-testid="practice-next-lap">第 {lapTimes.length + 1} 圈目標 {formatRaceTime(nextTarget)}</p> : null}
    </>}
  </section>;
}
