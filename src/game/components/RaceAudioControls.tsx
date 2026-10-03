import { useEffect, useRef, useState } from "react";
import { RaceAudio } from "../audio/RaceAudio";
import { RaceSoundCues } from "../audio/raceSoundCues";
import type { RaceSnapshot } from "../network/protocol";

export function RaceAudioControls({ snapshot, roomId }: { snapshot: RaceSnapshot | null; roomId: string | null }) {
  const audio = useRef<RaceAudio | null>(null);
  const cues = useRef(new RaceSoundCues());
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState("");
  useEffect(() => {
    return () => { audio.current?.dispose(); audio.current = null; };
  }, []);
  useEffect(() => { audio.current?.setVolume(enabled ? volume : 0); }, [enabled, volume]);
  // Event IDs belong to a room; audio permission and volume belong to this page.
  useEffect(() => { cues.current = new RaceSoundCues(); }, [roomId]);
  useEffect(() => {
    if (!snapshot) return;
    const sounds = cues.current.collect(snapshot);
    if (enabled) for (const sound of sounds) audio.current?.play(sound);
  }, [snapshot, enabled]);
  return <section className="race-audio" aria-label="音效設定">
    <button type="button" aria-pressed={enabled} onClick={async () => {
      if (enabled) { setEnabled(false); return; }
      try {
        let nextVolume = volume;
        try {
          const saved = localStorage.getItem("kart-lab:volume");
          if (saved !== null && Number.isFinite(Number(saved))) nextVolume = Math.max(0, Math.min(1, Number(saved)));
        } catch { /* Storage may be disabled; keep the session volume. */ }
        audio.current ??= new RaceAudio();
        await audio.current.resume();
        audio.current.setVolume(nextVolume);
        audio.current.play("pickup");
        setVolume(nextVolume);
        setEnabled(true); setError("");
      } catch { setError("無法啟用音效；遊戲仍可繼續。"); }
    }}>{enabled ? "靜音" : "啟用音效"}</button>
    <label>音量<input aria-label="音效音量" type="range" min="0" max="1" step="0.05" value={volume}
      onChange={(event) => {
        const next = Number(event.target.value); setVolume(next);
        try { localStorage.setItem("kart-lab:volume", String(next)); } catch { /* Session-only preference. */ }
      }} /></label>
    {error ? <small role="status">{error}</small> : null}
  </section>;
}
