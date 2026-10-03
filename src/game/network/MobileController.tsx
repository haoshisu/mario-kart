"use client";

import { Countdown, countdownCue } from "../components/Countdown";
import { DrivingGuide } from "../components/DrivingGuide";
import dynamic from "next/dynamic";
import { SnapshotBuffer } from "./interpolation";
import { useNetworkKeyboard } from "../input/useNetworkKeyboard";

import { createSnapshotDiagnostics } from "./snapshotDiagnostics";
import { InputSender } from "./inputSender";
import { ControllerItemPanel } from "./ControllerItemPanel";

import { Client, type Room } from "@colyseus/sdk";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import {
  TouchInputController,
  composeControllerInput,
  resetForBackground,
  type TouchControl,
} from "../input/touchInput";
import { TiltInputController, type DeviceTiltSample } from "../input/tiltInput";
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

type OrientationPermissionConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

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

function getScreenAngle() {
  return window.screen.orientation?.angle ?? 0;
}

function roomStorageKey(roomId: string) {
  return `kart-lab:controller:${roomId}`;
}

export function MobileController({ roomId }: MobileControllerProps) {
  const snapshotsRef = useRef(new SnapshotBuffer());
  const [keyboard, setKeyboard] = useState(false);
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
  const [preview, setPreview] = useState<KartInput>(EMPTY_KART_INPUT);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [tiltPermission, setTiltPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [sensitivity, setSensitivity] = useState(28);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const nicknameRef = useRef(nickname);
  const colorRef = useRef(color);
  const sequenceRef = useRef(0);
  const touchRef = useRef(new TouchInputController());
  const tiltRef = useRef(new TiltInputController(28));
  const tiltSteerRef = useRef(0);
  const lastTiltSampleRef = useRef<DeviceTiltSample | null>(null);
  const inputRef = useRef<KartInput>(EMPTY_KART_INPUT);
  const reconnectAttemptedRef = useRef(false);
  const roomWasClosedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const manuallyLeavingRef = useRef(false);
  const lastLatencyReportAtRef = useRef(0);
  const lastSnapshotUiAtRef = useRef(0);

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

  const syncInput = useCallback(() => {
    const next = composeControllerInput(
      touchRef.current.read(),
      tiltSteerRef.current,
      tiltEnabled,
    );
    inputRef.current = next;
    setPreview(next);
    sendInput(next);
  }, [sendInput, tiltEnabled]);

  const releaseAllInput = useCallback(() => {
    touchRef.current.reset();
    tiltSteerRef.current = 0;
    tiltRef.current.calibrate();
    inputRef.current = EMPTY_KART_INPUT;
    setPreview(EMPTY_KART_INPUT);
    sendInput(EMPTY_KART_INPUT);
  }, [sendInput]);

  const bindRoom = useCallback((room: Room) => {
    const publishDiagnostics = createSnapshotDiagnostics();
    snapshotsRef.current.clear();
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
      }),
    );

    room.onMessage<RoomStatusMessage>(ROOM_MESSAGE.roomStatus, (status) => {
      setRoomStatus(status);
    });
    room.onMessage<RaceSnapshot>(ROOM_MESSAGE.snapshot, (nextSnapshot) => {
      if (!snapshotsRef.current.add(nextSnapshot)) return;
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
      setLatencyMs(roundTripMs);
      if (
        now - lastLatencyReportAtRef.current >=
        NETWORK_CONFIG.latencyReportMinimumIntervalMs
      ) {
        lastLatencyReportAtRef.current = now;
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
      touchRef.current.reset();
      inputRef.current = EMPTY_KART_INPUT;
      setPreview(EMPTY_KART_INPUT);
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
      touchRef.current.reset();
      inputRef.current = EMPTY_KART_INPUT;
      setPreview(EMPTY_KART_INPUT);
      reconnectingRef.current = true;
      setReconnectToken(room.reconnectionToken);
      setPhase("reconnecting");
    });
    room.send(ROOM_MESSAGE.requestStatus);

    setPhase("connected");
    setError(null);
  }, [releaseAllInput, roomId]);

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
        protocolVersion: NETWORK_CONFIG.protocolVersion,
      });
      bindRoom(room);
    } catch (joinError) {
      setPhase("error");
      setError(connectionErrorMessage(joinError));
    }
  }, [bindRoom, color, nickname, roomId]);

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
      };
      if (typeof parsed.token !== "string") {
        sessionStorage.removeItem(roomStorageKey(roomId));
        return;
      }
      const reconnectionToken = parsed.token;
      const storedNickname = typeof parsed.nickname === "string" ? parsed.nickname : "";
      const storedColor = PLAYER_COLORS.find((candidate) => candidate === parsed.color) ?? PLAYER_COLORS[0];
      void Promise.resolve().then(() => {
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

  useEffect(() => {
    if (
      phase !== "connected" ||
      (roomStatus.phase !== "countdown" && roomStatus.phase !== "racing")
    ) {
      return;
    }
    sendInput(inputRef.current);
    const inputTimer = window.setInterval(
      () => sendInput(inputRef.current),
      1_000 / NETWORK_CONFIG.inputRateHz,
    );
    return () => {
      window.clearInterval(inputTimer);
    };
  }, [phase, roomStatus.phase, sendInput]);

  useEffect(() => {
    const handleVisibility = () => {
      if (resetForBackground(touchRef.current, document.hidden)) {
        releaseAllInput();
      }
    };
    const handleBackground = () => releaseAllInput();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBackground);
    window.addEventListener("pagehide", handleBackground);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBackground);
      window.removeEventListener("pagehide", handleBackground);
    };
  }, [releaseAllInput]);

  useEffect(() => {
    if (!tiltEnabled) {
      tiltSteerRef.current = 0;
      syncInput();
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const sample: DeviceTiltSample = {
        beta: event.beta,
        gamma: event.gamma,
        screenAngle: getScreenAngle(),
      };
      lastTiltSampleRef.current = sample;
      tiltSteerRef.current = tiltRef.current.update(sample);
      syncInput();
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [syncInput, tiltEnabled]);

  const requestTilt = useCallback(async () => {
    const orientation = window.DeviceOrientationEvent as OrientationPermissionConstructor | undefined;
    if (!orientation) {
      setTiltPermission("denied");
      setError("此瀏覽器不支援方向感測器；可繼續使用觸控方向鍵。");
      return;
    }

    try {
      const permission = orientation.requestPermission
        ? await orientation.requestPermission()
        : "granted";
      if (permission !== "granted") {
        setTiltPermission("denied");
        setTiltEnabled(false);
        setError("方向感測器權限遭拒；觸控方向鍵仍可使用。");
        return;
      }
      tiltRef.current.calibrate();
      setTiltPermission("granted");
      setTiltEnabled(true);
      setError(null);
    } catch {
      setTiltPermission("denied");
      setTiltEnabled(false);
      setError("無法啟用方向感測器；觸控方向鍵仍可使用。");
    }
  }, []);

  const updateTouch = useCallback((pointerId: number, control: TouchControl, pressed: boolean) => {
    if (pressed) {
      touchRef.current.press(pointerId, control);
    } else {
      touchRef.current.release(pointerId);
    }
    syncInput();
  }, [syncInput]);

  const pointerDown = (control: TouchControl) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    updateTouch(event.pointerId, control, true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic browser tests may not create an active native pointer.
    }
  };
  const pointerUp = (control: TouchControl) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    updateTouch(event.pointerId, control, false);
  };

  const keyboardSend = useCallback((input: KartInput) => {
    inputRef.current = input;
    setPreview(input);
    sendInput(input);
  }, [sendInput]);
  const ownPlayer = snapshot?.players.find((player) => player.id === currentPlayerId);
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
    <main className="controller-shell controller-shell--active player-screen" data-testid="mobile-controller" data-throttle={preview.throttle} data-steer={preview.steer}
      data-phase={roomStatus.phase} data-x={ownPlayer?.position[0]} data-z={ownPlayer?.position[2]}
      data-yaw={ownPlayer?.yaw} data-speed={ownPlayer?.speed} data-status={ownPlayer?.status}
      data-drift-tier={ownPlayer?.driftTier} data-turbo-tier={ownPlayer?.turboTier}>
      {currentPlayerId ? <PlayerGame trackId={roomStatus.trackId} players={roomStatus.players} snapshotsRef={snapshotsRef} playerId={currentPlayerId} /> : null}
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
      <p className="player-race-status">{ownPlayer ? `第 ${ownPlayer.rank} 名 · 第 ${Math.min(ownPlayer.completedLaps + 1, ownPlayer.totalLaps)}/${ownPlayer.totalLaps} 圈` : "同步中"} · 建議橫向遊玩</p>
      <section className="controller-options" aria-label="控制器設定">
        <button type="button" onClick={() => { releaseAllInput(); setTiltEnabled(false); setKeyboard(!keyboard); }}>{keyboard ? "切換觸控操作" : "切換鍵盤操作"}</button>
        {keyboard ? <DrivingGuide /> : null}
        <button disabled={keyboard} onClick={() => void requestTilt()} type="button">
          {tiltEnabled ? "傾斜已啟用" : tiltPermission === "denied" ? "重試傾斜" : "啟用傾斜"}
        </button>
        {tiltEnabled ? (
          <>
            <button
              onClick={() => tiltRef.current.calibrate(lastTiltSampleRef.current ?? undefined)}
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
                  setSensitivity(value);
                  tiltRef.current.setSensitivity(value);
                }}
                type="range"
                value={sensitivity}
              />
            </label>
          </>
        ) : null}
      </section>

      {!keyboard ? <section className="controller-pad" aria-label="卡丁車觸控控制">
        <div className="controller-pad__steering">
          <ControlButton control="left" label="左轉" onDown={pointerDown("left")} onUp={pointerUp("left")} pressed={preview.steer < 0}>←</ControlButton>
          <ControlButton control="right" label="右轉" onDown={pointerDown("right")} onUp={pointerUp("right")} pressed={preview.steer > 0}>→</ControlButton>
        </div>
        <div className="controller-pad__actions">
          <ControlButton control="drift" label="漂移" onDown={pointerDown("drift")} onUp={pointerUp("drift")} pressed={preview.drift}>DRIFT</ControlButton>
          <ControlButton control="brake" label="煞車或倒車" onDown={pointerDown("brake")} onUp={pointerUp("brake")} pressed={preview.brake > 0}>BRAKE</ControlButton>
          <ControlButton control="throttle" label="加速" onDown={pointerDown("throttle")} onUp={pointerUp("throttle")} pressed={preview.throttle > 0}>GAS</ControlButton>
        </div>
      </section> : null}
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
            <span>{player.nickname}</span>
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
  const player = snapshot?.players.find((candidate) => candidate.id === currentPlayerId);
  return (
    <section className="controller-result" data-testid="controller-result">
      <p className="eyebrow">RACE COMPLETE</p>
      <h1>{player?.status === "dnf" ? "DNF" : `第 ${player?.rank ?? "—"} 名`}</h1>
      <p>{player?.finishTime === null || player?.finishTime === undefined ? "未完成" : `${player.finishTime.toFixed(2)} 秒`}</p>
      <ol className="controller-result-ranking">
        {snapshot?.players.map((entry) => <li key={entry.id}>{entry.rank}. {entry.nickname} · {entry.status === "dnf" ? "DNF" : `${entry.finishTime?.toFixed(2)} 秒`}</li>)}
      </ol>
      <small>等待 Host 再玩一次或返回 Lobby</small>
    </section>
  );
}

type ControlButtonProps = {
  children: React.ReactNode;
  control: TouchControl;
  label: string;
  pressed: boolean;
  onDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

function ControlButton({ children, control, label, pressed, onDown, onUp }: ControlButtonProps) {
  return (
    <button
      aria-label={label}
      className={pressed ? "is-pressed" : undefined}
      data-control={control}
      onLostPointerCapture={onUp}
      onPointerCancel={onUp}
      onPointerDown={onDown}
      onPointerUp={onUp}
      type="button"
    >
      {children}
    </button>
  );
}
