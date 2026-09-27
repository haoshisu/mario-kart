"use client";

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
import { NETWORK_CONFIG } from "./networkConfig";
import {
  ROOM_MESSAGE,
  sanitizeInputApplied,
  type InputAppliedMessage,
  type ProtocolErrorMessage,
  type RoomClosedMessage,
  type RoomStatusMessage,
} from "./protocol";

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
  if (
    normalized.includes("full") ||
    normalized.includes("controller") ||
    normalized.includes("locked")
  ) {
    return "房間已有控制器，無法加入。";
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
  const [nickname, setNickname] = useState("");
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [hostStatus, setHostStatus] = useState<RoomStatusMessage["host"]>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<KartInput>(EMPTY_KART_INPUT);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [tiltPermission, setTiltPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [sensitivity, setSensitivity] = useState(28);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const nicknameRef = useRef(nickname);
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

  const syncInput = useCallback(() => {
    const next = composeControllerInput(
      touchRef.current.read(),
      tiltSteerRef.current,
      tiltEnabled,
    );
    inputRef.current = next;
    setPreview(next);
  }, [tiltEnabled]);

  const sendInput = useCallback((input: KartInput) => {
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

  const releaseAllInput = useCallback(() => {
    touchRef.current.reset();
    tiltSteerRef.current = 0;
    tiltRef.current.calibrate();
    inputRef.current = EMPTY_KART_INPUT;
    setPreview(EMPTY_KART_INPUT);
    sendInput(EMPTY_KART_INPUT);
  }, [sendInput]);

  const bindRoom = useCallback((room: Room) => {
    roomRef.current = room;
    roomWasClosedRef.current = false;
    reconnectingRef.current = false;
    manuallyLeavingRef.current = false;
    setReconnectToken(null);
    sequenceRef.current = 0;
    lastLatencyReportAtRef.current = 0;
    room.reconnection.enabled = false;
    sessionStorage.setItem(
      roomStorageKey(roomId),
      JSON.stringify({ token: room.reconnectionToken, nickname: nicknameRef.current }),
    );

    room.onMessage<RoomStatusMessage>(ROOM_MESSAGE.roomStatus, (status) => {
      setHostStatus(status.host);
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
        JSON.stringify({ token: room.reconnectionToken, nickname: nicknameRef.current }),
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
    const deadline = Date.now() + (NETWORK_CONFIG.reconnectSeconds * 1_000 - 500);
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
      });
      bindRoom(room);
    } catch (joinError) {
      setPhase("error");
      setError(connectionErrorMessage(joinError));
    }
  }, [bindRoom, nickname, roomId]);

  const leaveRoom = useCallback(() => {
    const room = roomRef.current;
    releaseAllInput();
    sessionStorage.removeItem(roomStorageKey(roomId));
    roomRef.current = null;
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
      const parsed = JSON.parse(stored) as { token?: unknown; nickname?: unknown };
      if (typeof parsed.token !== "string") {
        sessionStorage.removeItem(roomStorageKey(roomId));
        return;
      }
      const reconnectionToken = parsed.token;
      const storedNickname = typeof parsed.nickname === "string" ? parsed.nickname : "";
      void Promise.resolve().then(() => {
        nicknameRef.current = storedNickname;
        setNickname(storedNickname);
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
    if (phase !== "connected") {
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
  }, [phase, sendInput]);

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

  if (phase !== "connected" && phase !== "reconnecting") {
    return (
      <main className="controller-shell">
        <section className="controller-join-card">
          <p className="eyebrow">PHONE CONTROLLER · {roomId}</p>
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
          {error ? <p className="controller-error" role="alert">{error}</p> : null}
          <button disabled={phase === "connecting"} onClick={() => void joinRoom()} type="button">
            {phase === "connecting" ? "連線中…" : "加入房間"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="controller-shell controller-shell--active" data-testid="mobile-controller">
      <header className="controller-status-bar">
        <div>
          <span>{phase === "reconnecting" ? "RECONNECTING" : "CONNECTED"}</span>
          <strong>{roomId}</strong>
        </div>
        <p>{hostStatus === "reconnecting" ? "Host 重連中" : `${nickname || "Driver"} · ${latencyMs ?? "—"} ms`}</p>
        <button onClick={leaveRoom} type="button">離開</button>
      </header>

      {error ? <p className="controller-toast" role="status">{error}</p> : null}

      <section className="controller-options" aria-label="控制器設定">
        <button onClick={() => void requestTilt()} type="button">
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

      <section className="controller-pad" aria-label="卡丁車觸控控制">
        <div className="controller-pad__steering">
          <ControlButton control="left" label="左轉" onDown={pointerDown("left")} onUp={pointerUp("left")} pressed={preview.steer < 0}>←</ControlButton>
          <ControlButton control="right" label="右轉" onDown={pointerDown("right")} onUp={pointerUp("right")} pressed={preview.steer > 0}>→</ControlButton>
        </div>
        <div className="controller-pad__actions">
          <ControlButton control="drift" label="漂移" onDown={pointerDown("drift")} onUp={pointerUp("drift")} pressed={preview.drift}>DRIFT</ControlButton>
          <ControlButton control="brake" label="煞車或倒車" onDown={pointerDown("brake")} onUp={pointerUp("brake")} pressed={preview.brake > 0}>BRAKE</ControlButton>
          <ControlButton control="throttle" label="加速" onDown={pointerDown("throttle")} onUp={pointerUp("throttle")} pressed={preview.throttle > 0}>GAS</ControlButton>
        </div>
      </section>
    </main>
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
