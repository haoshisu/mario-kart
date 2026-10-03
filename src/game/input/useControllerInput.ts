import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import { NETWORK_CONFIG } from "../network/networkConfig";
import { TouchInputController, composeControllerInput, type TouchControl } from "./touchInput";
import { TiltInputController, type DeviceTiltSample } from "./tiltInput";

type OrientationPermissionConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function getScreenAngle() {
  return window.screen.orientation?.angle ?? 0;
}

function sameInput(left: KartInput, right: KartInput) {
  return left.throttle === right.throttle && left.brake === right.brake &&
    left.steer === right.steer && left.drift === right.drift;
}

/** Device intent only: connection ownership and authoritative state stay outside this hook. */
export function useControllerInput({ sendInput, heartbeatEnabled, keyboard, autoAccelerate, setError }: {
  sendInput: (input: KartInput) => void;
  heartbeatEnabled: boolean;
  keyboard: boolean;
  autoAccelerate: boolean;
  setError: (error: string | null) => void;
}) {
  const [preview, setPreview] = useState<KartInput>(EMPTY_KART_INPUT);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [tiltPermission, setTiltPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [sensitivity, setSensitivity] = useState(28);
  const touchRef = useRef(new TouchInputController());
  const tiltRef = useRef(new TiltInputController(28));
  const tiltSteerRef = useRef(0);
  const lastTiltSampleRef = useRef<DeviceTiltSample | null>(null);
  const foregroundRef = useRef(true);
  const inputRef = useRef<KartInput>(EMPTY_KART_INPUT);
  const resetInput = useCallback(() => {
    touchRef.current.reset();
    tiltSteerRef.current = 0;
    tiltRef.current.calibrate();
    inputRef.current = EMPTY_KART_INPUT;
    setPreview(EMPTY_KART_INPUT);
  }, []);

  const syncInput = useCallback(() => {
    if (keyboard) return;
    const next = foregroundRef.current && heartbeatEnabled ? composeControllerInput(
      touchRef.current.read(),
      tiltSteerRef.current,
      tiltEnabled,
      autoAccelerate,
    ) : EMPTY_KART_INPUT;
    inputRef.current = next;
    setPreview((current) => sameInput(current, next) ? current : next);
    sendInput(next);
  }, [sendInput, tiltEnabled, keyboard, heartbeatEnabled, autoAccelerate]);

  const releaseAllInput = useCallback(() => {
    resetInput();
    sendInput(EMPTY_KART_INPUT);
  }, [resetInput, sendInput]);

  useEffect(() => { syncInput(); }, [syncInput]);

  useEffect(() => {
    if (!heartbeatEnabled || keyboard) {
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
  }, [heartbeatEnabled, keyboard, sendInput]);

  useEffect(() => {
    const handleBackground = () => {
      foregroundRef.current = false;
      releaseAllInput();
    };
    const handleForeground = () => {
      if (document.hidden) return;
      foregroundRef.current = true;
      syncInput();
    };
    const handleVisibility = () => document.hidden ? handleBackground() : handleForeground();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBackground);
    window.addEventListener("pagehide", handleBackground);
    window.addEventListener("focus", handleForeground);
    window.addEventListener("pageshow", handleForeground);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBackground);
      window.removeEventListener("pagehide", handleBackground);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("pageshow", handleForeground);
    };
  }, [releaseAllInput, syncInput]);

  useEffect(() => {
    if (!tiltEnabled) {
      tiltSteerRef.current = 0;
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
  }, [setError]);

  const updateTouch = useCallback((pointerId: number, control: TouchControl, pressed: boolean) => {
    if (pressed) {
      touchRef.current.press(pointerId, control);
    } else {
      touchRef.current.release(pointerId);
    }
    syncInput();
  }, [syncInput]);

  const keyboardSend = useCallback((input: KartInput) => {
    inputRef.current = input;
    setPreview((current) => sameInput(current, input) ? current : input);
    sendInput(input);
  }, [sendInput]);
  const calibrateTilt = () => tiltRef.current.calibrate(lastTiltSampleRef.current ?? undefined);
  const updateSensitivity = (value: number) => {
    setSensitivity(value);
    tiltRef.current.setSensitivity(value);
  };

  return { preview, tiltEnabled, setTiltEnabled, tiltPermission, sensitivity,
    requestTilt, calibrateTilt, updateSensitivity, releaseAllInput, resetInput, updateTouch, keyboardSend };
}
