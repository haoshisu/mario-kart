import { getDriftTierConfig } from "../core/kart/kartConfig";
import type { KartTelemetry } from "../runtime/kartRuntime";
import { Countdown } from "./Countdown";
import { FinishScreen } from "./FinishScreen";
import { RaceHud } from "./RaceHud";

type GameHudProps = {
  cameraMode: "drive" | "inspect";
  ready: boolean;
  telemetry: KartTelemetry;
  onRestart: () => void;
  onToggleCamera: () => void;
};

function getStatus(telemetry: KartTelemetry, ready: boolean) {
  if (telemetry.race.phase === "COUNTDOWN") {
    return "GET READY";
  }
  if (telemetry.race.phase === "FINISHED") {
    return "FINISHED";
  }
  if (telemetry.race.respawnProtectionRemaining > 0) {
    return "RESPAWNING";
  }
  if (telemetry.impact === "heavy") {
    return "HEAVY IMPACT";
  }
  if (telemetry.impact === "light") {
    return "WALL HIT";
  }
  if (telemetry.turboActive) {
    return getDriftTierConfig(telemetry.turboTier)?.label ?? "MINI TURBO";
  }
  if (telemetry.driftTier > 0) {
    return `DRIFT LEVEL ${telemetry.driftTier}`;
  }
  if (telemetry.drifting) {
    return "DRIFTING";
  }
  return ready && telemetry.race.phase === "RACING" ? "READY" : "LOADING PHYSICS";
}

export function GameHud({
  cameraMode,
  ready,
  telemetry,
  onRestart,
  onToggleCamera,
}: GameHudProps) {
  const status = getStatus(telemetry, ready);

  return (
    <div className="kart-hud" data-testid="game-hud">
      <output
        className="visually-hidden"
        data-testid="kart-runtime"
        data-speed={telemetry.signedSpeed}
        data-y={telemetry.height}
        data-x={telemetry.position[0]}
        data-yaw={telemetry.yaw}
        data-z={telemetry.position[1]}
        data-race-phase={telemetry.race.phase}
        data-race-time={telemetry.race.elapsedTime}
        data-completed-laps={telemetry.race.completedLaps}
        data-checkpoint={telemetry.race.checkpoint}
        data-respawns={telemetry.race.respawnCount}
        data-respawn-protection={telemetry.race.respawnProtectionRemaining}
        data-drift-tier={telemetry.driftTier}
        data-turbo-tier={telemetry.turboTier}
      >
        Kart and race runtime telemetry
      </output>

      <RaceHud race={telemetry.race} />

      <div className="kart-hud__telemetry">
        <span>SPEED</span>
        <strong data-testid="speed-value">{Math.round(telemetry.speedKph)}</strong>
        <small>KM/H</small>
      </div>

      <div
        className={`kart-hud__status kart-hud__status--${status.toLowerCase().replaceAll(" ", "-")}`}
        data-testid="kart-status"
      >
        {status}
      </div>

      <div className="drift-meter" aria-label={`漂移等級 ${telemetry.driftTier}`}>
        <span>DRIFT</span>
        {[1, 2, 3].map((tier) => (
          <i
            className={telemetry.driftTier >= tier ? "is-active" : undefined}
            key={tier}
          />
        ))}
      </div>

      <button className="camera-toggle" onClick={onToggleCamera} type="button">
        {cameraMode === "drive" ? "檢查賽道" : "返回駕駛"}
      </button>

      <div className="kart-hud__controls">
        {cameraMode === "drive" ? (
          <>
            <span><kbd>W</kbd> / <kbd>↑</kbd> 加速</span>
            <span><kbd>S</kbd> / <kbd>↓</kbd> 煞車／倒車</span>
            <span><kbd>A D</kbd> / <kbd>← →</kbd> 轉向</span>
            <span><kbd>SPACE</kbd> 漂移</span>
          </>
        ) : (
          <span>拖曳旋轉 · 滾輪縮放 · 右鍵平移</span>
        )}
      </div>

      <Countdown cue={telemetry.race.countdownCue} />
      <FinishScreen onRestart={onRestart} race={telemetry.race} />
    </div>
  );
}
