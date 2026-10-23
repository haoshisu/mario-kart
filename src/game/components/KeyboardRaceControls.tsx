import { DrivingGuide } from "./DrivingGuide";
import { useState } from "react";
import { TouchDrivingPad } from "./TouchDrivingPad";
import { useNetworkKeyboard } from "../input/useNetworkKeyboard";
import { ControllerItemPanel } from "../network/ControllerItemPanel";
import type { KartInput } from "../core/kart/kartTypes";
import type { HostRoomState } from "../network/useHostRoom";

export function KeyboardRaceControls({ state, sendInput, useItem }: {
  state: HostRoomState;
  sendInput: (input: KartInput) => void;
  useItem: (revision: number) => void;
}) {
  const [touch, setTouch] = useState(false);
  const playerId = state.playerId;
  const player = state.snapshot?.players.find((candidate) => candidate.id === playerId);
  const enabled = state.phase === "open" && state.racePhase === "racing" && player?.status === "racing";
  useNetworkKeyboard(enabled && !touch, sendInput, () => {
    if (player?.item.held && player.item.cooldown === 0 && player.item.lockRemaining === 0 && player.spinOutRemaining === 0) {
      useItem(player.item.revision);
    }
  });
  if (state.racePhase === "finished" || (state.racePhase === "racing" && (player?.status === "finished" || player?.status === "dnf"))) return null;
  return <aside className="keyboard-race-controls" aria-label="鍵盤駕駛" data-testid="keyboard-race-controls">
    <div className="keyboard-race-controls__input">
    <button type="button" onClick={() => setTouch(!touch)}>{touch ? "切換鍵盤操作" : "切換觸控操作"}</button>
    {!touch ? <DrivingGuide /> : null}
    </div>
    {touch && enabled ? <TouchDrivingPad sendInput={sendInput} /> : null}
    <ControllerItemPanel snapshot={state.snapshot} playerId={playerId} connected={enabled} onUse={useItem} />
  </aside>;
}
