import { getPracticeTour } from "../core/race/practiceTour";
import { usePracticeTour } from "../runtime/usePracticeTour";
import { TRACK_CATALOG, type TrackId } from "../track/trackCatalog";
import { formatRaceTime } from "./RaceHud";
import { TrackPicker } from "./TrackPicker";
import styles from "./PracticeTrackPicker.module.css";

export function PracticeTrackPicker({ value, onChange }: { value: TrackId; onChange: (id: TrackId) => void }) {
  const view = usePracticeTour();
  const tour = getPracticeTour(view.records, value);
  const best = view.records[value];
  return <div className={styles.picker}>
    <section className={styles.tour} aria-label="本機練習巡遊" data-testid="practice-tour">
      <strong>賽道巡遊</strong>
      <p>每站完成三圈，收集完賽紀錄。</p>
      {view.loaded && !view.unavailable ? <>
        <div className={styles.progress}>
          <label>台灣巡遊 <b data-testid="taiwan-tour-count">{tour.taiwanCompleted} / {tour.taiwanTotal}</b>
            <progress aria-label="台灣巡遊完成賽道" value={tour.taiwanCompleted} max={tour.taiwanTotal} /></label>
          <label>全圖巡遊 <b data-testid="all-tour-count">{tour.completed} / {tour.total}</b>
            <progress aria-label="全圖巡遊完成賽道" value={tour.completed} max={tour.total} /></label>
        </div>
        {tour.taiwanCompleted === tour.taiwanTotal ? <p className={styles.complete}>台灣六站巡遊達成！</p> : null}
        {tour.nextTrack ? <button type="button" data-testid="tour-next-track" onClick={() => { if (tour.nextTrack) onChange(tour.nextTrack); }}>
          下一站 · {TRACK_CATALOG[tour.nextTrack].name}
        </button> : <p className={styles.complete}>全圖巡遊達成！選一站挑戰自己的紀錄。</p>}
        <small>本機練習 · 僅此瀏覽器 · 所有賽道皆可自由選擇</small>
      </> : <p>{view.unavailable ? "無法讀取本機進度，仍可自由選圖。" : "讀取本機進度…"}</p>}
    </section>
    <TrackPicker value={value} onChange={onChange} records={view.loaded && !view.unavailable ? view.records : undefined} />
    <div className={styles.best} data-testid="selected-practice-record">
      <strong>{TRACK_CATALOG[value].name} · 練習紀錄</strong>
      {best ? <p>三圈最佳 {formatRaceTime(best.bestTotal)} · 最快單圈 {formatRaceTime(best.bestLap)}</p>
        : <p>{view.unavailable ? "本機紀錄無法讀取" : view.loaded ? "尚未完成三圈，從這一站開始挑戰。" : "讀取中…"}</p>}
    </div>
  </div>;
}
