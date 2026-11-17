import { RaceResults, PersonalFinishNotice } from "./RaceResults";
import { rematchUnavailableReason } from "../core/results/raceResults";
import { Countdown, countdownCue } from "./Countdown";
import type { HostRoomPhase } from "../network/useHostRoom";
import type { RaceSnapshot } from "../network/protocol";
import { ItemEventFeedback, ItemStatus } from "./ItemStatus";

type MultiplayerHudProps = {
  snapshot: RaceSnapshot | null;
  roomPhase: HostRoomPhase;
  onReturnLobby: () => void;
  onRematch: () => void;
  hasConnectedHuman: boolean;
  playerId: string | null;
};

export function MultiplayerHud({ snapshot, roomPhase, onReturnLobby, onRematch, hasConnectedHuman, playerId }: MultiplayerHudProps) {
  if (!snapshot) {
    return <div className="multiplayer-hud multiplayer-hud--loading">{roomPhase === "idle" || roomPhase === "error"
      ? "建立多人賽事房間，邀請 2～4 位玩家加入並準備。"
      : roomPhase === "creating" ? "正在建立多人房間…" : "正在連線至房間…"}</div>;
  }
  const rematchReason = rematchUnavailableReason(snapshot.players, hasConnectedHuman);
  const ordered = [...snapshot.players].sort((left, right) => left.rank - right.rank);

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
            data-stunt-progress={player.stuntProgress}
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
            <span>{player.nickname}{player.stuntProgress > 0 && <small> ✦ 空中特技</small>}<ItemStatus item={player.item} compact /></span>
            <small>
              {player.status === "dnf"
                ? "DNF"
                : player.status === "finished"
                  ? `${player.finishTime?.toFixed(2) ?? "—"}s`
                  : `${Math.min(player.completedLaps + 1, player.totalLaps)}/${player.totalLaps}`}
            </small>
          </li>
        ))}
      </ol>
      <ItemEventFeedback snapshot={snapshot} />
      <PersonalFinishNotice snapshot={snapshot} playerId={playerId} />
      {snapshot.phase === "racing" && snapshot.finishRemaining !== null ?
        <p className="finish-deadline" role="status">首位已完賽 · 剩餘 {Math.ceil(snapshot.finishRemaining)} 秒，逾時記為 DNF</p> : null}

      {snapshot.phase === "finished" ? (
        <section className="multiplayer-results" data-testid="multiplayer-results">
          <RaceResults snapshot={snapshot} playerId={playerId} />
          <button onClick={onRematch} type="button" data-testid="rematch"
            disabled={rematchReason !== null} aria-describedby="rematch-status">
            再玩一次
          </button>
          <p id="rematch-status" role="status">{rematchReason ?? "再玩一次會保留本場賽道與已連線車手，直接開始倒數。"}</p>
          <button onClick={onReturnLobby} type="button">返回 Lobby</button>
        </section>
      ) : null}
    </div>
  );
}
