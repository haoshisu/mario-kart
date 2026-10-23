"use client";

import { RaceResults, PersonalFinishNotice } from "../components/RaceResults";
import { Countdown, countdownCue } from "../components/Countdown";
import { DrivingGuide } from "../components/DrivingGuide";
import { RaceAudioControls } from "../components/RaceAudioControls";
import dynamic from "next/dynamic";
import { SnapshotBuffer } from "./interpolation";
import { useNetworkKeyboard } from "../input/useNetworkKeyboard";

import { CharacterPicker } from "../components/CharacterPicker";
import { CHARACTERS, DEFAULT_CHARACTER, isCharacterId, type CharacterId } from "../entities/characters";
import { createSnapshotDiagnostics } from "./snapshotDiagnostics";
import { InputSender } from "./inputSender";
import { ControllerItemPanel } from "./ControllerItemPanel";

import { Client, type Room } from "@colyseus/sdk";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type KartInput } from "../core/kart/kartTypes";
import { TouchControlPad } from "../components/TouchControlPad";
import { useControllerInput } from "../input/useControllerInput";
import { getGameServerEndpoint } from "./endpoint";
import {
  CLIENT_RECONNECT_TIMEOUT_MS,
  NETWORK_CONFIG,
  PLAYER_COLORS,
  PLAYER_COLOR_VALUES,
  type PlayerColor,
} from "./networkConfig";
import {
  ROOM_MESSAGE,
  sanitizeInputApplied,
  type InputAppliedMessage,
  type ProtocolErrorMessage,
  type RaceSnapshot,
  type RoomClosedMessage,
  type RoomStatusMessage,
} from "./protocol";

const PlayerGame = dynamic(() => import("../Game").then((module) => module.PlayerGame), { ssr: false });

type ConnectionPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "error";

type MobileControllerProps = {
  roomId: string;
};

function connectionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("full")) {
    return "房間已滿，最多只能加入四位玩家。";
  }
  if (normalized.includes("already started") || normalized.includes("locked")) {
    return "比賽已開始，請等待下一場。";
  }
  if (normalized.includes("color") || normalized.includes("colour")) {
    return "這個車色已被使用，請選擇其他顏色。";
  }
  if (normalized.includes("not found") || normalized.includes("seat reservation")) {
    return "找不到房間，房間可能不存在或已關閉。";
  }
  return `連線失敗：${message}`;
}

function roomStorageKey(roomId: string) {
  return `kart-lab:controller:${roomId}`;
}

export function MobileController({ roomId }: MobileControllerProps) {
  const snapshotsRef = useRef(new SnapshotBuffer());
  const [keyboard, setKeyboard] = useState(false);
  const [characterId, setCharacterId] = useState<CharacterId>(DEFAULT_CHARACTER);
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState<PlayerColor | undefined>(undefined);
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [roomStatus, setRoomStatus] = useState<RoomStatusMessage>({
    mode: "multiplayer",
    trackId: "meadow",
    host: "disconnected",
    phase: "lobby",
    players: [],
    canStart: false,
  });
  const [snapshot, setSnapshot] = useState<RaceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const ownPlayer = snapshot?.players.find((player) => player.id === currentPlayerId);
  const roomRef = useRef<Room | null>(null);
  const characterRef = useRef(characterId);
  const nicknameRef = useRef(nickname);
  const colorRef = useRef(color);
  const sequenceRef = useRef(0);
  const reconnectAttemptedRef = useRef(false);
  const roomWasClosedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const manuallyLeavingRef = useRef(false);
  const lastLatencyReportAtRef = useRef(0);
  const lastSnapshotUiAtRef = useRef(0);
  const resultPhaseRef = useRef<RaceSnapshot["phase"] | null>(null);

  const transmitInput = useCallback((input: KartInput) => {
    const room = roomRef.current;
    if (!room) {
      return;
    }
    try {
      room.send(ROOM_MESSAGE.input, {
        sequence: sequenceRef.current,
        sentAt: Date.now(),
        input,
      });
      sequenceRef.current += 1;
    } catch {
      // Server timeout still guarantees neutral input if this socket is already gone.
    }
  }, []);

  const senderRef = useRef<InputSender | null>(null);
  const sendInput = useCallback((input: KartInput) => {
    senderRef.current ??= new InputSender(transmitInput);
    senderRef.current.send(input);
  }, [transmitInput]);

  useEffect(() => () => {
    senderRef.current?.dispose();
    senderRef.current = null;
  }, []);

  const { preview, tiltEnabled, setTiltEnabled, tiltPermission, sensitivity,
    requestTilt, calibrateTilt, updateSensitivity, releaseAllInput, resetInput, updateTouch, keyboardSend } = useControllerInput({
    sendInput, keyboard, setError,
    autoAccelerate: phase === "connected" && roomStatus.phase === "racing" && ownPlayer?.status === "racing",
    heartbeatEnabled: phase === "connected" && (roomStatus.phase === "countdown" || roomStatus.phase === "racing"),
  });

  const bindRoom = useCallback((room: Room) => {
    const publishDiagnostics = createSnapshotDiagnostics();
    snapshotsRef.current.clear();
    senderRef.current?.dispose();
    senderRef.current = null;
    resetInput();
    roomRef.current = room;
    setCurrentPlayerId(room.sessionId);
    roomWasClosedRef.current = false;
    reconnectingRef.current = false;
    manuallyLeavingRef.current = false;
    setReconnectToken(null);
    sequenceRef.current = 0;
    lastLatencyReportAtRef.current = 0;
    room.reconnection.enabled = false;
    sessionStorage.setItem(
      roomStorageKey(roomId),
      JSON.stringify({
        token: room.reconnectionToken,
        nickname: nicknameRef.current,
        color: colorRef.current,
        characterId: characterRef.current,
      }),
    );

    room.onMessage<RoomStatusMessage>(ROOM_MESSAGE.roomStatus, (status) => {
      setRoomStatus(status);
    });
    room.onMessage<RaceSnapshot>(ROOM_MESSAGE.snapshot, (nextSnapshot) => {
      if (!snapshotsRef.current.add(nextSnapshot)) return;
      if (resultPhaseRef.current !== nextSnapshot.phase) {
        resultPhaseRef.current = nextSnapshot.phase;
        setError(null);
      }
      publishDiagnostics?.(nextSnapshot);
      setRoomStatus((current) => (
        current.phase === nextSnapshot.phase
          ? current
          : { ...current, phase: nextSnapshot.phase }
      ));
      const now = Date.now();
      if (
        now - lastSnapshotUiAtRef.current >= 150 ||
        nextSnapshot.phase === "finished"
      ) {
        lastSnapshotUiAtRef.current = now;
        setSnapshot(nextSnapshot);
      }
    });
    room.onMessage<InputAppliedMessage>(ROOM_MESSAGE.inputApplied, (message) => {
      const applied = sanitizeInputApplied(message);
      if (!applied) {
        return;
      }
      const now = Date.now();
      const roundTripMs = Math.round(Math.min(5_000, Math.max(0, now - applied.sentAt)));
      if (
        now - lastLatencyReportAtRef.current >=
        NETWORK_CONFIG.latencyReportMinimumIntervalMs
      ) {
        lastLatencyReportAtRef.current = now;
        setLatencyMs(roundTripMs);
        room.send(ROOM_MESSAGE.latencyReport, { rttMs: roundTripMs });
      }
    });
    room.onMessage<RoomClosedMessage>(ROOM_MESSAGE.roomClosed, () => {
      roomWasClosedRef.current = true;
      roomRef.current = null;
      setCurrentPlayerId(null);
      sessionStorage.removeItem(roomStorageKey(roomId));
      releaseAllInput();
      setPhase("closed");
      setError("Host 已關閉房間。");
    });
    room.onMessage<ProtocolErrorMessage>(ROOM_MESSAGE.protocolError, (message) => {
      if (message.code !== "rate-limited") {
        setError(message.message);
      }
    });
    room.onDrop(() => {
      resetInput();
      senderRef.current?.dispose();
      senderRef.current = null;
      reconnectingRef.current = true;
      setReconnectToken(room.reconnectionToken);
      setPhase("reconnecting");
    });
    room.onReconnect(() => {
      sequenceRef.current = 0;
      setPhase("connected");
      setError(null);
      sessionStorage.setItem(
        roomStorageKey(roomId),
        JSON.stringify({
          token: room.reconnectionToken,
          nickname: nicknameRef.current,
          color: colorRef.current,
          characterId: characterRef.current,
        }),
      );
    });
    room.onLeave(() => {
      if (
        roomRef.current !== room ||
        reconnectingRef.current ||
        roomWasClosedRef.current ||
        manuallyLeavingRef.current
      ) {
        return;
      }
      resetInput();
      senderRef.current?.dispose();
      senderRef.current = null;
      reconnectingRef.current = true;
      setReconnectToken(room.reconnectionToken);
      setPhase("reconnecting");
    });
    room.send(ROOM_MESSAGE.requestStatus);

    setPhase("connected");
    setError(null);
  }, [releaseAllInput, resetInput, roomId]);

  useEffect(() => {
    if (!reconnectToken) {
      return;
    }

    let cancelled = false;
    const deadline = Date.now() + CLIENT_RECONNECT_TIMEOUT_MS;
    const reconnect = async () => {
      while (!cancelled && Date.now() < deadline) {
        try {
          const client = new Client(getGameServerEndpoint());
          const room = await client.reconnect(reconnectToken);
          if (cancelled) {
            await room.leave();
            return;
          }
          bindRoom(room);
          return;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }

      if (!cancelled) {
        reconnectingRef.current = false;
        roomRef.current = null;
        setCurrentPlayerId(null);
        setReconnectToken(null);
        setPhase("error");
        setError("重連逾時，請重新加入房間。");
      }
    };
    void reconnect();
    return () => {
      cancelled = true;
    };
  }, [bindRoom, reconnectToken]);

  const joinRoom = useCallback(async () => {
    if (!nickname.trim()) {
      setError("請先輸入暱稱。");
      return;
    }
    setPhase("connecting");
    setError(null);
    try {
      const client = new Client(getGameServerEndpoint());
      const room = await client.joinById(roomId, {
        role: "controller",
        nickname,
        color,
        characterId,
        protocolVersion: NETWORK_CONFIG.protocolVersion,
      });
      bindRoom(room);
    } catch (joinError) {
      setPhase("error");
      setError(connectionErrorMessage(joinError));
    }
  }, [bindRoom, color, characterId, nickname, roomId]);

  const leaveRoom = useCallback(() => {
    const room = roomRef.current;
    releaseAllInput();
    sessionStorage.removeItem(roomStorageKey(roomId));
    roomRef.current = null;
    setCurrentPlayerId(null);
    manuallyLeavingRef.current = true;
    setPhase("idle");
    setError(null);
    if (room) {
      void room.leave();
    }
  }, [releaseAllInput, roomId]);

  useEffect(() => {
    if (reconnectAttemptedRef.current) {
      return;
    }
    reconnectAttemptedRef.current = true;

    const stored = sessionStorage.getItem(roomStorageKey(roomId));
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        token?: unknown;
        nickname?: unknown;
        color?: unknown;
        characterId?: unknown;
      };
      if (typeof parsed.token !== "string") {
        sessionStorage.removeItem(roomStorageKey(roomId));
        return;
      }
      const reconnectionToken = parsed.token;
      const storedCharacter = isCharacterId(parsed.characterId) ? parsed.characterId : DEFAULT_CHARACTER;
      const storedNickname = typeof parsed.nickname === "string" ? parsed.nickname : "";
      const storedColor = PLAYER_COLORS.find((candidate) => candidate === parsed.color) ?? PLAYER_COLORS[0];
      void Promise.resolve().then(() => {
        characterRef.current = storedCharacter;
        setCharacterId(storedCharacter);
        nicknameRef.current = storedNickname;
        colorRef.current = storedColor;
        setNickname(storedNickname);
        setColor(storedColor);
        setPhase("connecting");
        const client = new Client(getGameServerEndpoint());
        void client.reconnect(reconnectionToken).then(bindRoom).catch((reconnectError: unknown) => {
          sessionStorage.removeItem(roomStorageKey(roomId));
          setPhase("error");
          setError(connectionErrorMessage(reconnectError));
        });
      });
    } catch {
      sessionStorage.removeItem(roomStorageKey(roomId));
    }
  }, [bindRoom, roomId]);



  useNetworkKeyboard(keyboard && phase === "connected" && roomStatus.phase === "racing", keyboardSend, () => {
    if (ownPlayer?.item.held && ownPlayer.item.cooldown === 0 && ownPlayer.item.lockRemaining === 0) {
      roomRef.current?.send(ROOM_MESSAGE.useItem, { revision: ownPlayer.item.revision });
    }
  });

  if (phase !== "connected" && phase !== "reconnecting") {
    return (
      <main className="controller-shell">
        <section className="controller-join-card">
          <p className="eyebrow">JOIN RACE · {roomId}</p>
          <h1>連接駕駛座</h1>
          <label htmlFor="controller-nickname">暱稱</label>
          <input
            autoComplete="nickname"
            disabled={phase === "connecting"}
            id="controller-nickname"
            maxLength={NETWORK_CONFIG.nicknameMaxLength}
            onChange={(event) => {
              nicknameRef.current = event.target.value;
              setNickname(event.target.value);
            }}
            placeholder="Driver"
            value={nickname}
          />
          <CharacterPicker value={characterId} disabled={phase === "connecting"} onChange={id => { characterRef.current = id; setCharacterId(id); }} />
          <fieldset className="controller-colors">
            <legend>車身顏色</legend>
            <button type="button" aria-pressed={color === undefined} onClick={() => { colorRef.current = undefined; setColor(undefined); }}>自動</button>
            {PLAYER_COLORS.map((candidate) => (
              <button
                aria-label={`選擇 ${candidate} 顏色`}
                aria-pressed={color === candidate}
                key={candidate}
                onClick={() => {
                  colorRef.current = candidate;
                  setColor(candidate);
                }}
                style={{ backgroundColor: PLAYER_COLOR_VALUES[candidate] }}
                type="button"
              />
            ))}
          </fieldset>
          {error ? <p className="controller-error" role="alert">{error}</p> : null}
          <button disabled={phase === "connecting"} onClick={() => void joinRoom()} type="button">
            {phase === "connecting" ? "連線中…" : "加入房間"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="controller-shell controller-shell--active player-screen" data-testid="mobile-controller" data-throttle={preview.throttle} data-brake={preview.brake} data-drift={preview.drift} data-steer={preview.steer}
      data-phase={roomStatus.phase} data-x={ownPlayer?.position[0]} data-z={ownPlayer?.position[2]}
      data-yaw={ownPlayer?.yaw} data-speed={ownPlayer?.speed} data-status={ownPlayer?.status}
      data-drift-tier={ownPlayer?.driftTier} data-turbo-tier={ownPlayer?.turboTier}>
      {currentPlayerId ? <PlayerGame trackId={roomStatus.trackId} players={roomStatus.players} snapshotsRef={snapshotsRef} playerId={currentPlayerId} /> : null}
      <RaceAudioControls roomId={roomId} snapshot={snapshot} playerId={currentPlayerId} trackId={roomStatus.trackId} />
      <header className="controller-status-bar">
        <div>
          <span>{phase === "reconnecting" ? "RECONNECTING" : "CONNECTED"}</span>
          <strong>{roomId}</strong>
        </div>
        <p>{roomStatus.host === "reconnecting" ? "Host 重連中" : `${nickname || "Driver"} · ${latencyMs ?? "—"} ms`}</p>
        <button onClick={leaveRoom} type="button">離開</button>
      </header>

      {error ? <p className="controller-toast" role="status">{error}</p> : null}

      {roomStatus.phase === "lobby" ? (
        <ControllerLobby
          currentPlayerId={currentPlayerId}
          onReady={(ready) => roomRef.current?.send(ROOM_MESSAGE.playerReady, { ready })}
          status={roomStatus}
        />
      ) : null}

      <PersonalFinishNotice snapshot={snapshot} playerId={currentPlayerId} />
      {roomStatus.phase === "finished" ? (
        <ControllerResult currentPlayerId={currentPlayerId} snapshot={snapshot} />
      ) : null}

      <div data-testid="controller-countdown"><Countdown cue={countdownCue(
        roomStatus.phase === "countdown" ? snapshot?.countdownRemaining ?? 3 : 0,
        roomStatus.phase === "racing", snapshot?.elapsedTime ?? 2,
      )} /></div>

      {roomStatus.phase === "countdown" || roomStatus.phase === "racing" ? <>
      <ControllerItemPanel snapshot={snapshot} playerId={currentPlayerId} connected={phase === "connected"}
        onUse={(revision) => roomRef.current?.send(ROOM_MESSAGE.useItem, { revision })} />
      <p className="player-race-status">{ownPlayer ? `第 ${ownPlayer.rank} 名 · 第 ${Math.min(ownPlayer.completedLaps + 1, ownPlayer.totalLaps)}/${ownPlayer.totalLaps} 圈` : "同步中"} {!keyboard ? " · 自動加速" : ""} · 建議橫向遊玩</p>
      <section className="controller-options" aria-label="控制器設定">
        <button type="button" onClick={() => { releaseAllInput(); setTiltEnabled(false); setKeyboard(!keyboard); }}>{keyboard ? "切換觸控操作" : "切換鍵盤操作"}</button>
        {keyboard ? <DrivingGuide /> : null}
        <button disabled={keyboard} onClick={() => void requestTilt()} type="button">
          {tiltEnabled ? "傾斜已啟用" : tiltPermission === "denied" ? "重試傾斜" : "啟用傾斜"}
        </button>
        {tiltEnabled ? (
          <>
            <button
              onClick={calibrateTilt}
              type="button"
            >
              校正
            </button>
            <label>
              靈敏度
              <input
                aria-label="傾斜靈敏度"
                max="60"
                min="10"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  updateSensitivity(value);
                }}
                type="range"
                value={sensitivity}
              />
            </label>
          </>
        ) : null}
      </section>

      {!keyboard ? <TouchControlPad input={preview} updateTouch={updateTouch} /> : null}
      </> : null}
    </main>
  );
}

function ControllerLobby({
  currentPlayerId,
  onReady,
  status,
}: {
  currentPlayerId: string | null;
  onReady: (ready: boolean) => void;
  status: RoomStatusMessage;
}) {
  const current = status.players.find((player) => player.id === currentPlayerId);
  return (
    <section className="controller-lobby" data-testid="controller-lobby">
      <p className="eyebrow">RACE LOBBY · {status.players.length}/{NETWORK_CONFIG.maximumPlayers}</p>
      <h1>等待 Host 開賽</h1>
      <ul>
        {status.players.map((player) => (
          <li key={player.id}>
            <i style={{ backgroundColor: PLAYER_COLOR_VALUES[player.color] }} />
            <span>{player.nickname} · {CHARACTERS[player.characterId].name}</span>
            <strong>{player.isBot ? "CPU" : player.connection === "reconnecting" ? "重連中" : player.ready ? "READY" : "等待"}</strong>
          </li>
        ))}
      </ul>
      <button
        className={current?.ready ? "is-ready" : undefined}
        disabled={!current || current.connection !== "connected"}
        onClick={() => onReady(!current?.ready)}
        type="button"
      >
        {current?.ready ? "取消準備" : "準備完成"}
      </button>
    </section>
  );
}

function ControllerResult({
  currentPlayerId,
  snapshot,
}: {
  currentPlayerId: string | null;
  snapshot: RaceSnapshot | null;
}) {
  return (
    <section className="controller-result" data-testid="controller-result">
      <RaceResults snapshot={snapshot} playerId={currentPlayerId} />
      <small>等待房主再玩一次或返回 Lobby；下一場開始時會自動進入倒數。</small>
    </section>
  );
}
