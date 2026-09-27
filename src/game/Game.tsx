"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { GameScene } from "./components/GameScene";
import { GameHud } from "./components/GameHud";
import { HostRoomPanel } from "./components/HostRoomPanel";
import { useKeyboardInput } from "./input/useKeyboardInput";
import { useHostRoom } from "./network/useHostRoom";
import {
  createKartRuntimeState,
  INITIAL_KART_TELEMETRY,
  type KartTelemetry,
} from "./runtime/kartRuntime";
import { createRaceCommands } from "./runtime/raceRuntime";

export function Game() {
  const [cameraMode, setCameraMode] = useState<"drive" | "inspect">("drive");
  const [ready, setReady] = useState(false);
  const [telemetry, setTelemetry] = useState<KartTelemetry>(INITIAL_KART_TELEMETRY);
  const runtimeRef = useRef(createKartRuntimeState());
  const raceCommandsRef = useRef(createRaceCommands());
  const keyboardInputRef = useKeyboardInput(cameraMode === "drive");
  const hostRoom = useHostRoom();
  const controllerActive = hostRoom.state.controller !== "waiting";
  const inputRef = controllerActive ? hostRoom.inputRef : keyboardInputRef;
  const handleReady = useCallback(() => setReady(true), []);
  const handleTelemetry = useCallback((nextTelemetry: KartTelemetry) => {
    setTelemetry(nextTelemetry);
  }, []);
  const toggleCamera = useCallback(() => {
    setCameraMode((current) => (current === "drive" ? "inspect" : "drive"));
  }, []);
  const handleRestart = useCallback(() => {
    raceCommandsRef.current.restartRequested = true;
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("e2e") !== "1") {
      return;
    }
    const advanceRace = () => {
      raceCommandsRef.current.syntheticCrossingsRequested += 1;
    };
    const forceRespawn = () => {
      raceCommandsRef.current.forcedRespawnRequested = true;
    };
    const restartRace = () => {
      raceCommandsRef.current.restartRequested = true;
    };
    window.addEventListener("kart-race-test-advance", advanceRace);
    window.addEventListener("kart-race-test-respawn", forceRespawn);
    window.addEventListener("kart-race-test-restart", restartRace);
    return () => {
      window.removeEventListener("kart-race-test-advance", advanceRace);
      window.removeEventListener("kart-race-test-respawn", forceRespawn);
      window.removeEventListener("kart-race-test-restart", restartRace);
    };
  }, []);

  return (
    <div className="game-canvas">
      <Canvas
        camera={{ position: [34, 30, 36], fov: 44, near: 0.1, far: 180 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        shadows
      >
        <color args={["#a8c9df"]} attach="background" />
        <fog args={["#a8c9df", 48, 105]} attach="fog" />
        <Suspense fallback={null}>
          <GameScene
            cameraMode={cameraMode}
            inputReceiptRef={hostRoom.inputReceiptRef}
            inputEnabled={cameraMode === "drive"}
            inputRef={inputRef}
            onInputApplied={hostRoom.acknowledgeInput}
            raceCommandsRef={raceCommandsRef}
            onReady={handleReady}
            onTelemetry={handleTelemetry}
            runtimeRef={runtimeRef}
          />
        </Suspense>
        {cameraMode === "inspect" ? (
          <OrbitControls
            enableDamping
            enablePan
            maxDistance={78}
            maxPolarAngle={Math.PI / 2.04}
            minDistance={12}
            minPolarAngle={Math.PI / 8}
            target={[0, 0.5, 0]}
          />
        ) : null}
      </Canvas>
      <GameHud
        cameraMode={cameraMode}
        onRestart={handleRestart}
        onToggleCamera={toggleCamera}
        ready={ready}
        telemetry={telemetry}
      />
      <HostRoomPanel
        onClose={() => void hostRoom.closeRoom()}
        onCreate={() => void hostRoom.createRoom()}
        state={hostRoom.state}
      />
    </div>
  );
}
