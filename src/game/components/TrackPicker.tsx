import { TRACK_CATALOG, TRACK_IDS, type TrackId } from "../track/trackCatalog";
import { getTrackData } from "../track/trackData";
import type { PracticeRecords } from "../core/race/practiceTour";
import { formatRaceTime } from "./RaceHud";
import styles from "./TrackPicker.module.css";

export function TrackPicker({ value, onChange, records }: { value: TrackId; onChange: (id: TrackId) => void; records?: PracticeRecords }) {
  const selected = TRACK_CATALOG[value];
  return <div className={styles.picker}>
    <div className={styles.grid} role="group" aria-label="選擇賽道">
      {TRACK_IDS.map((id) => {
        const track = getTrackData(id);
        const path = track.samples.map((sample, index) => `${index ? "L" : "M"}${sample.position.join(",")}`).join(" ") + "Z";
        return <button key={id} type="button" aria-pressed={id === value} onClick={() => onChange(id)}
          className={styles.card} style={{ background: `linear-gradient(135deg, ${track.sky}, ${track.colors.grass})` }}>
          <svg viewBox={track.bounds.viewBox} aria-hidden="true">
            <path d={path} fill="none" stroke="#12233c" strokeWidth="8" />
            <path d={path} fill="none" stroke={track.accent} strokeWidth="4" />
          </svg>
          <strong>{track.name}</strong><small>{track.subtitle}</small>
          {records ? <span className={styles.record} data-testid={`track-record-${id}`}>{records[id] ? `已完成 · ${formatRaceTime(records[id].bestTotal)}` : "待挑戰"}</span> : null}
        </button>;
      })}
    </div>
    <p className={styles.description}><b>{selected.difficulty} · 高低差 {Math.max(...selected.elevation.map((key) => key[1]))} m</b>{selected.description}</p>
  </div>;
}
