import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { RaceAudio } from "../audio/RaceAudio";
import { RaceSoundCues } from "../audio/raceSoundCues";
import type { RaceSnapshot } from "../network/protocol";
import type { KartRuntimeState } from "../runtime/kartRuntime";
import { DrivingSoundCues } from "../audio/drivingSound";
import { getTrackData } from "../track/trackData";
import { crossingPhase } from "../track/parkObstacle";
import type { TrackId } from "../track/trackCatalog";
import { NETWORK_CONFIG } from "../network/networkConfig";

export function RaceAudioControls({ snapshot, roomId, playerId, runtimeRef, practiceActive = false, trackId }: {
  snapshot: RaceSnapshot | null; roomId: string | null; playerId?: string | null;
  runtimeRef?: RefObject<KartRuntimeState>; practiceActive?: boolean; trackId: TrackId;
}) {
  const audio = useRef<RaceAudio | null>(null);
  const cues = useRef(new RaceSoundCues());
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState("");
  const latest = useRef({ snapshot, playerId, runtimeRef, practiceActive });
  useEffect(() => { latest.current = { snapshot, playerId, runtimeRef, practiceActive }; }, [snapshot, playerId, runtimeRef, practiceActive]);
  const crossing = useMemo(() => {
    if (trackId !== "taipei") return undefined;
    const branch = getTrackData(trackId).branches.find(branch => branch.id === "taipei-crossing");
    return branch?.samples[Math.floor(branch.samples.length / 2)];
  }, [trackId]);
  useEffect(() => {
    return () => { audio.current?.dispose(); audio.current = null; };
  }, []);
  useEffect(() => { audio.current?.setVolume(enabled ? volume : 0); }, [enabled, volume]);
  // Event IDs belong to a room; audio permission and volume belong to this page.
  useEffect(() => { cues.current = new RaceSoundCues(); }, [roomId]);
  useEffect(() => {
    if (!snapshot) return;
    const sounds = cues.current.collect(snapshot);
    if (enabled && !document.hidden) for (const sound of sounds) if (sound !== "boost") audio.current?.play(sound);
  }, [snapshot, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const drivingCues = new DrivingSoundCues();
    let frame = 0, lastUpdate = -Infinity, warned = false;
    const silence = () => audio.current?.drive(0, false, false, false);
    const update = (now: number) => {
      frame = requestAnimationFrame(update);
      if (now - lastUpdate < 40) return;
      lastUpdate = now;
      const source = latest.current, race = source.snapshot;
      const player = race?.players.find(player => player.id === source.playerId);
      const runtime = source.runtimeRef?.current;
      const active = !document.hidden && (runtime ? source.practiceActive && !runtime.finished
        : race?.phase === "racing" && player?.status === "racing" && player.connection === "connected");
      const speed = runtime?.speed ?? player?.speed ?? 0;
      const drifting = runtime?.drifting ?? player?.drifting ?? false;
      const tier = runtime?.driftTier ?? player?.driftTier ?? 0;
      const draft = player?.slipstream;
      const boosting = (runtime?.turboRemaining ?? player?.turboTier ?? 0) > 0 || (player?.item.boostRemaining ?? 0) > 0 || (draft?.boostRemaining ?? 0) > 0;
      audio.current?.drive(speed, drifting, boosting, Boolean(active), draft?.charge ?? 0);
      for (const sound of drivingCues.collect(tier, boosting, Boolean(active), draft)) audio.current?.play(sound);
      const seconds = runtime?.trackSeconds ?? (race?.tick ?? 0) / NETWORK_CONFIG.simulationRateHz;
      const x = runtime?.position.x ?? player?.position[0] ?? 0, z = runtime?.position.z ?? player?.position[2] ?? 0;
      const warning = Boolean(active && crossing && crossingPhase(seconds) !== "clear" &&
        Math.hypot(x - crossing.position[0], z - crossing.position[1]) < 45);
      if (warning && !warned) audio.current?.play("crossing");
      warned = warning;
    };
    frame = requestAnimationFrame(update);
    document.addEventListener("visibilitychange", silence);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", silence); silence(); };
  }, [enabled, roomId, trackId, crossing]);
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
