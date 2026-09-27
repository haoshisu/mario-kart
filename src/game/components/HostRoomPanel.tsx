"use client";

import { QRCode } from "@/components/QRCode";
import { useState } from "react";
import type { HostRoomState } from "../network/useHostRoom";

type HostRoomPanelProps = {
  state: HostRoomState;
  onCreate: () => void;
  onClose: () => void;
};

function controllerStatus(state: HostRoomState) {
  if (state.controller === "connected") {
    return `${state.controllerNickname ?? "Driver"} 已連線`;
  }
  if (state.controller === "reconnecting") {
    return "手機重連中，輸入已歸零";
  }
  return "等待手機加入";
}

export function HostRoomPanel({ state, onCreate, onClose }: HostRoomPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const controllerUrl =
    state.roomId && typeof window !== "undefined"
      ? `${window.location.origin}/controller/${encodeURIComponent(state.roomId)}`
      : null;

  if (state.phase === "idle" || state.phase === "error") {
    return (
      <aside className="host-room-panel host-room-panel--compact" data-testid="host-room-panel">
        <span>PHONE CONTROLLER</span>
        {state.error ? <p className="host-room-panel__error">{state.error}</p> : null}
        <button
          onClick={() => {
            setCollapsed(false);
            onCreate();
          }}
          type="button"
        >
          建立手機控制房間
        </button>
      </aside>
    );
  }

  if (state.phase === "creating") {
    return (
      <aside className="host-room-panel host-room-panel--compact" data-testid="host-room-panel">
        <span>PHONE CONTROLLER</span>
        <p>正在建立安全房間…</p>
      </aside>
    );
  }

  if (collapsed) {
    return (
      <aside className="host-room-panel host-room-panel--compact" data-testid="host-room-panel">
        <p data-testid="controller-status">{controllerStatus(state)}</p>
        <button aria-expanded={false} onClick={() => setCollapsed(false)} type="button">
          顯示 QR Code
        </button>
      </aside>
    );
  }

  return (
    <aside className="host-room-panel" data-testid="host-room-panel">
      <div className="host-room-panel__copy">
        <button aria-expanded={true} onClick={() => setCollapsed(true)} type="button">
          收起 QR Code
        </button>
        <span>ROOM CODE</span>
        <strong data-testid="room-code">{state.roomId}</strong>
        <p data-testid="controller-status">{controllerStatus(state)}</p>
        <small data-testid="latency-value">
          {state.latencyMs === null ? "等待控制回饋樣本" : `控制回饋 RTT ${state.latencyMs} ms`}
        </small>
        <button onClick={onClose} type="button">
          關閉房間
        </button>
      </div>
      {controllerUrl ? <QRCode label="手機控制器連結 QR Code" value={controllerUrl} /> : null}
    </aside>
  );
}
