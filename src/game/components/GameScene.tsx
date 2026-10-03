import { JumpRamps } from "./JumpRamps";
import { BoostPads } from "./BoostPads";
import { memo, type RefObject } from "react";
import type { KartInput } from "../core/kart/kartTypes";
import type { InputAppliedMessage } from "../network/protocol";
import type { KartRuntimeState, KartTelemetry } from "../runtime/kartRuntime";
import type { RaceCommands } from "../runtime/raceRuntime";
import { Ground } from "./Ground";
import { FollowCamera } from "./FollowCamera";
import { SceneLights } from "./SceneLights";
import { Track } from "./Track";
import { TrackDecorations } from "./TrackDecorations";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { RaceMarkers } from "./RaceMarkers";

type GameSceneProps = {
  cameraMode: "drive" | "inspect";
  inputEnabled: boolean;
  inputRef: RefObject<KartInput>;
  inputReceiptRef: RefObject<InputAppliedMessage | null>;
  runtimeRef: RefObject<KartRuntimeState>;
  raceCommandsRef: RefObject<RaceCommands>;
  onReady: () => void;
  onInputApplied: (message: InputAppliedMessage) => void;
  onTelemetry: (telemetry: KartTelemetry) => void;
};

export const GameScene = memo(function GameScene({
  cameraMode,
  inputEnabled,
  inputRef,
  inputReceiptRef,
  runtimeRef,
  raceCommandsRef,
  onReady,
  onInputApplied,
  onTelemetry,
}: GameSceneProps) {
  return (
    <>
      <SceneLights />
      <PhysicsWorld
        inputEnabled={inputEnabled}
        inputRef={inputRef}
        inputReceiptRef={inputReceiptRef}
        raceCommandsRef={raceCommandsRef}
        onReady={onReady}
        onInputApplied={onInputApplied}
        onTelemetry={onTelemetry}
        runtimeRef={runtimeRef}
      />
      <Ground />
      <Track />
      <RaceMarkers />
      <BoostPads />
      <JumpRamps />
      <TrackDecorations />
      {cameraMode === "drive" ? <FollowCamera runtimeRef={runtimeRef} /> : null}
    </>
  );
});
