import { TRACK_CATALOG, TRACK_IDS, type TrackId } from "../track/trackCatalog";
import { getTrackData } from "../track/trackData";
import styles from "./TrackPicker.module.css";

export function TrackPicker({ value, onChange }: { value: TrackId; onChange: (id: TrackId) => void }) {
  const selected = TRACK_CATALOG[value];
  return <div className={styles.picker}>
    <div className={styles.grid} role="group" aria-label="選擇賽道">
      {TRACK_IDS.map((id) => {
        const track = getTrackData(id);
        const path = track.samples.map((sample, index) => `${index ? "L" : "M"}${sample.position.join(",")}`).join(" ") + "Z";
        return <button key={id} type="button" aria-pressed={id === value} onClick={() => onChange(id)}
          className={styles.card} style={{ background: `linear-gradient(135deg, ${track.sky}, ${track.colors.grass})` }}>
          <svg viewBox="-60 -21 120 75" aria-hidden="true">
            <path d={path} fill="none" stroke="#12233c" strokeWidth="8" />
            <path d={path} fill="none" stroke={track.accent} strokeWidth="4" />
          </svg>
          <strong>{track.name}</strong><small>{track.subtitle}</small>
        </button>;
      })}
    </div>
    <p className={styles.description}><b>{selected.difficulty} · 高低差 {Math.max(...selected.elevation.map((key) => key[1]))} m</b>{selected.description}</p>
  </div>;
}
