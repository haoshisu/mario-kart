import { Countdown, countdownCue } from "./Countdown";
import type { HostRoomPhase } from "../network/useHostRoom";
import type { RaceSnapshot } from "../network/protocol";
import { NETWORK_CONFIG } from "../network/networkConfig";
import { ItemEventFeedback, ItemStatus } from "./ItemStatus";

type MultiplayerHudProps = {
  snapshot: RaceSnapshot | null;
  roomPhase: HostRoomPhase;
  onReturnLobby: () => void;
  onRematch: () => void;
  hasConnectedHuman: boolean;
};

export function MultiplayerHud({ snapshot, roomPhase, onReturnLobby, onRematch, hasConnectedHuman }: MultiplayerHudProps) {
  if (!snapshot) {
    return <div className="multiplayer-hud multiplayer-hud--loading">{roomPhase === "idle" || roomPhase === "error"
      ? "建立多人賽事房間，邀請 2～4 位玩家加入並準備。"
      : roomPhase === "creating" ? "正在建立多人房間…" : "正在連線至房間…"}</div>;
  }
  const ordered = [...snapshot.players].sort((left, right) => left.rank - right.rank);
  const active = snapshot.players.filter((player) => player.status !== "dnf");
  let centerX = 0;
  let centerZ = 0;
  active.forEach((player) => {
    centerX += player.position[0];
    centerZ += player.position[2];
  });
  centerX = active.length > 0 ? centerX / active.length : 0;
  centerZ = active.length > 0 ? centerZ / active.length : 0;

  return (
    <div className="multiplayer-hud" data-testid="multiplayer-hud">
      <output
        className="visually-hidden"
        data-testid="multiplayer-runtime"
        data-phase={snapshot.phase}
        data-tick={snapshot.tick}
        data-traps={snapshot.items.traps.length}
      >
        {snapshot.players.map((player) => (
          <span
            data-checkpoint={player.checkpointIndex}
            data-impact={player.impactRevision}
            data-item={player.item.held ?? "none"}
            data-reserve-item={player.item.reserve ?? "none"}
            data-item-revision={player.item.revision}
            data-item-boost={player.item.boostRemaining}
            data-item-shield={player.item.shieldRemaining}
            data-item-lock={player.item.lockRemaining}
            data-drifting={player.drifting}
            data-drift-tier={player.driftTier}
            data-turbo-tier={player.turboTier}
            data-laps={player.completedLaps}
            data-player-id={player.id}
            data-rank={player.rank}
            data-speed={player.speed}
            data-spinout={player.spinOutRemaining}
            data-status={player.status}
            data-x={player.position[0]}
            data-y={player.position[1]}
            data-yaw={player.yaw}
            data-z={player.position[2]}
            key={player.id}
          >
            {player.nickname}
          </span>
        ))}
      </output>

      <div data-testid="multiplayer-countdown">
        <Countdown cue={countdownCue(snapshot.countdownRemaining, snapshot.phase === "racing", snapshot.elapsedTime)} />
      </div>

      <ol className="multiplayer-ranking" aria-label="即時排名">
        {ordered.map((player) => (
          <li key={player.id}>
            <strong>{player.rank}</strong>
            <span>{player.nickname}<ItemStatus item={player.item} compact /></span>
            <small>
              {player.status === "dnf"
                ? "DNF"
                : player.status === "finished"
                  ? `${player.finishTime?.toFixed(2) ?? "—"}s`
                  : `${Math.min(player.completedLaps + 1, player.totalLaps)}/${player.totalLaps}${
                    Math.hypot(player.position[0] - centerX, player.position[2] - centerZ) >
                      NETWORK_CONFIG.sharedCamera.farPlayerDistance
                      ? " · 離群"
                      : ""
                  }`}
            </small>
          </li>
        ))}
      </ol>
      <ItemEventFeedback snapshot={snapshot} />
      {snapshot.phase === "racing" && snapshot.finishRemaining !== null ?
        <p className="finish-deadline" role="status">首位已完賽 · 剩餘 {Math.ceil(snapshot.finishRemaining)} 秒，逾時記為 DNF</p> : null}

      {snapshot.phase === "finished" ? (
        <section className="multiplayer-results" data-testid="multiplayer-results">
          <p>RACE COMPLETE</p>
          <h2>賽事結果</h2>
          <ol>
            {ordered.map((player) => (
              <li key={player.id}>
                <strong>{player.rank}. {player.nickname}</strong>
                <span>{player.status === "dnf" ? "DNF" : `${player.finishTime?.toFixed(2)} 秒`}</span>
              </li>
            ))}
          </ol>
          <button onClick={onRematch} type="button" data-testid="rematch"
            disabled={!hasConnectedHuman || snapshot.players.filter((player) => player.connection === "connected").length < 2 ||
              snapshot.players.some((player) => player.connection === "reconnecting")}>
            再玩一次
          </button>
          <button onClick={onReturnLobby} type="button">返回 Lobby</button>
        </section>
      ) : null}
    </div>
  );
}
