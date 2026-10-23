import type { RaceSnapshot } from "../network/protocol";
import { TRACK_CATALOG } from "../track/trackCatalog";
import { raceResultSummary } from "../core/results/raceResults";
import styles from "./RaceResults.module.css";

/** Both displays use the final authoritative snapshot; never infer a result from live rank. */
export function RaceResults({ snapshot, playerId }: { snapshot: RaceSnapshot | null; playerId: string | null }) {
  if (!snapshot || snapshot.phase !== "finished") return <p role="status">正在同步最終成績…</p>;
  const { ordered, winner, own, gap } = raceResultSummary(snapshot.players, playerId);
  return <div className={styles.content}>
    <p className={styles.track}>{TRACK_CATALOG[snapshot.trackId].name}</p>
    <h2>賽事結果</h2>
    <div className={styles.winner} data-testid="race-winner">
      <span>{winner ? "本場冠軍" : "本場無人完賽"}</span>
      {winner ? <strong>{winner.nickname}</strong> : null}
    </div>
    {own ? <div className={styles.personal} data-testid="personal-result">
      <strong>{own.status === "dnf" ? "DNF · 未完賽" : `第 ${own.rank} 名`}</strong>
      <span>{own.status === "finished" && own.finishTime !== null ? `${own.finishTime.toFixed(2)} 秒` : "未取得有效完賽時間"}</span>
      {gap !== null ? <small>{own.id === winner?.id ? "率先衝線！" : `距離冠軍 +${gap.toFixed(2)} 秒`}</small> : null}
    </div> : null}
    <ol aria-label="最終排名" className={styles.ranking}>
      {ordered.map(player => <li key={player.id} className={player.id === playerId ? styles.own : undefined} aria-current={player.id === playerId ? "true" : undefined}>
        <strong>{player.rank}. {player.nickname}</strong>
        <span>{player.status === "dnf" ? "DNF" : player.finishTime !== null ? `${player.finishTime.toFixed(2)} 秒` : "—"}</span>
      </li>)}
    </ol>
    {ordered.some(player => player.status === "dnf") ? <p className={styles.note}>DNF 表示未完成比賽，不列入完賽時間比較。</p> : null}
  </div>;
}

export function PersonalFinishNotice({ snapshot, playerId }: { snapshot: RaceSnapshot | null; playerId: string | null }) {
  const own = snapshot?.players.find(player => player.id === playerId);
  if (snapshot?.phase !== "racing" || own?.status !== "finished") return null;
  return <p className={styles.waiting} role="status" data-testid="personal-finish-notice">
    已完賽 · 第 {own.rank} 名 · {own.finishTime?.toFixed(2) ?? "—"} 秒<br />
    等待其他車手，{Math.ceil(snapshot.finishRemaining ?? 0)} 秒內公布最終結果
  </p>;
}
