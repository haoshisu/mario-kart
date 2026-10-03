"use client";

import { QRCode } from "@/components/QRCode";
import { useState } from "react";
import { PLAYER_COLOR_VALUES } from "../network/networkConfig";
import type { HostRoomState } from "../network/useHostRoom";
import type { RoomMode } from "../network/protocol";

import { TrackPicker } from "./TrackPicker";
import { TRACK_CATALOG, type TrackId } from "../track/trackCatalog";

type HostRoomPanelProps = {
  state: HostRoomState;
  selectedTrackId: TrackId;
  onSelectTrack: (id: TrackId) => void;
  onCreate: (mode?: RoomMode, hostPlays?: boolean) => void;
  onClose: () => void;
  onStart: () => void;
};

function playerStatus(state: HostRoomState) {
  if (state.players.some((player) => player.connection === "reconnecting")) {
    return "玩家重連中，該車輸入已歸零";
  }
  if (state.mode !== "multiplayer") return `${state.players.filter((player) => !player.isBot).length}/1 位玩家 · 3 位電腦`;
  return `${state.players.length}/4 位玩家`;
}

export function HostRoomPanel({ state, onCreate, onClose, onStart, selectedTrackId, onSelectTrack }: HostRoomPanelProps) {
  const [hostPlays, setHostPlays] = useState(true);
  const [panelPreference, setPanelPreference] = useState<{
    roomId: string | null; racePhase: HostRoomState["racePhase"]; collapsed: boolean;
  } | null>(null);
  const autoCollapsed = state.racePhase === "countdown" || state.racePhase === "racing" || state.racePhase === "finished";
  const collapsed = panelPreference?.roomId === state.roomId && panelPreference.racePhase === state.racePhase
    ? panelPreference.collapsed : autoCollapsed;
  const setCollapsed = (next: boolean) => setPanelPreference({ roomId: state.roomId, racePhase: state.racePhase, collapsed: next });
  const controllerUrl =
    state.roomId && typeof window !== "undefined"
      ? `${window.location.origin}/controller/${encodeURIComponent(state.roomId)}`
      : null;

  if (state.phase === "idle" || state.phase === "error") {
    return (
      <aside
        className="host-room-panel host-room-panel--compact"
        data-room-phase={state.phase}
        data-testid="host-room-panel"
      >
        <span>CHOOSE YOUR CIRCUIT</span>
        <TrackPicker value={selectedTrackId} onChange={onSelectTrack} />
        <label><input type="checkbox" checked={hostPlays} onChange={(event) => setHostPlays(event.target.checked)} />房主直接參賽</label>
        {state.error ? <p className="host-room-panel__error">{state.error}</p> : null}
        <button
          onClick={() => {
            setCollapsed(false);
            onCreate("multiplayer", hostPlays);
          }}
          type="button"
        >
          建立多人賽事房間
        </button>
        <p>或獨自挑戰 3 位電腦對手</p>
        <button type="button" onClick={() => { setCollapsed(false); onCreate("solo-keyboard"); }}>單人對戰・鍵盤</button>
        <button type="button" onClick={() => { setCollapsed(false); onCreate("solo-phone"); }}>單人對戰・手機</button>
      </aside>
    );
  }

  if (state.phase === "creating") {
    return (
      <aside
        className="host-room-panel host-room-panel--compact"
        data-room-phase={state.phase}
        data-testid="host-room-panel"
      >
        <span>MULTIPLAYER RACE</span>
        <p role="status">正在啟動伺服器並建立房間…</p>
        <p>免費主機休眠後可能需要約一分鐘，最多等待 90 秒。</p>
        <button type="button" onClick={onClose}>取消連線</button>
      </aside>
    );
  }

  if (collapsed) {
    return (
      <aside
        className="host-room-panel host-room-panel--compact"
        data-room-phase={state.phase}
        data-testid="host-room-panel"
      >
        <p data-testid="controller-status">{playerStatus(state)}</p>
        <button aria-expanded={false} onClick={() => setCollapsed(false)} type="button">
          顯示 QR Code
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="host-room-panel"
      data-room-phase={state.phase}
      data-testid="host-room-panel"
    >
      <div className="host-room-panel__copy">
        <button aria-expanded={true} onClick={() => setCollapsed(true)} type="button">
          收起 QR Code
        </button>
        <span>ROOM CODE</span>
        <p data-testid="room-track">{TRACK_CATALOG[state.trackId].name}</p>
        {state.mode !== "multiplayer" ? <p>單人對戰 · {state.mode === "solo-keyboard" ? "鍵盤操作" : "掃碼加入 1 位玩家"} · 3 位電腦</p> : null}
        {controllerUrl && state.mode !== "solo-keyboard" ? <a href={controllerUrl} target="_blank" rel="noreferrer">開啟／分享玩家連結</a> : null}
        <strong data-testid="room-code">{state.roomId}</strong>
        <p data-testid="controller-status">{playerStatus(state)}</p>
        <ul className="host-room-panel__players">
          {state.players.map((player) => (
            <li key={player.id}>
              <i style={{ backgroundColor: PLAYER_COLOR_VALUES[player.color] }} />
              <span>{player.nickname}</span>
              <b>{player.isBot ? "CPU" : player.connection === "reconnecting" ? "重連" : player.ready ? "READY" : "等待"}</b>
            </li>
          ))}
        </ul>
        {state.racePhase === "lobby" ? (
          <button data-testid="start-race" disabled={!state.canStart} onClick={onStart} type="button">
            {state.canStart ? "開始比賽" : state.mode === "solo-phone" ? "等待手機玩家加入並準備" : state.players.length < 2 ? "至少需要 2 位玩家" : "等待所有玩家準備"}
          </button>
        ) : null}
        <small data-testid="latency-value">
          {state.latencyMs === null ? "等待控制回饋樣本" : `控制回饋 RTT ${state.latencyMs} ms`}
        </small>
        <button onClick={onClose} type="button">
          關閉房間
        </button>
      </div>
      {controllerUrl && state.mode !== "solo-keyboard" ? <QRCode label="手機控制器連結 QR Code" value={controllerUrl} /> : null}
    </aside>
  );
}
