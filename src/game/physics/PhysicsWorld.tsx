import type { CharacterId } from "../entities/characters";
import { Physics } from "@react-three/rapier";
import type { RefObject } from "react";
import { KART_CONFIG } from "../core/kart/kartConfig";
import type { KartInput } from "../core/kart/kartTypes";
import type { InputAppliedMessage } from "../network/protocol";
import type { KartRuntimeState, KartTelemetry } from "../runtime/kartRuntime";
import type { RaceCommands } from "../runtime/raceRuntime";
import { KartBody } from "./KartBody";
import { TrackColliders } from "./TrackColliders";
import { RaceSensors } from "./RaceSensors";

type PhysicsWorldProps = {
  characterId: CharacterId;
  inputEnabled: boolean;
  inputRef: RefObject<KartInput>;
  inputReceiptRef: RefObject<InputAppliedMessage | null>;
  runtimeRef: RefObject<KartRuntimeState>;
  raceCommandsRef: RefObject<RaceCommands>;
  onReady: () => void;
  onInputApplied: (message: InputAppliedMessage) => void;
  onTelemetry: (telemetry: KartTelemetry) => void;
};

export function PhysicsWorld({
  characterId,
  inputEnabled,
  inputRef,
  inputReceiptRef,
  runtimeRef,
  raceCommandsRef,
  onReady,
  onInputApplied,
  onTelemetry,
}: PhysicsWorldProps) {
  return (
    <Physics updatePriority={-2} interpolate gravity={[0, -9.81, 0]} timeStep={KART_CONFIG.fixedTimeStep}>
      <TrackColliders />
      <RaceSensors />
      <KartBody
        characterId={characterId}
        inputEnabled={inputEnabled}
        inputRef={inputRef}
        inputReceiptRef={inputReceiptRef}
        raceCommandsRef={raceCommandsRef}
        onReady={onReady}
        onInputApplied={onInputApplied}
        onTelemetry={onTelemetry}
        runtimeRef={runtimeRef}
      />
    </Physics>
  );
}
