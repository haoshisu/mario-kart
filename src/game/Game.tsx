"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { memo, type RefObject, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CourseMap } from "./components/CourseMap";
import { GameScene } from "./components/GameScene";
import { GameHud } from "./components/GameHud";
import { HostRoomPanel } from "./components/HostRoomPanel";
import { MultiplayerHud } from "./components/MultiplayerHud";
import { MultiplayerScene } from "./components/MultiplayerScene";
import { RaceAudioControls } from "./components/RaceAudioControls";
import { KeyboardRaceControls } from "./components/KeyboardRaceControls";
import { useKeyboardInput } from "./input/useKeyboardInput";
import { useHostRoom } from "./network/useHostRoom";
import {
  createKartRuntimeState,
  INITIAL_KART_TELEMETRY,
  type KartTelemetry,
} from "./runtime/kartRuntime";
import { createRaceCommands } from "./runtime/raceRuntime";
import type { SnapshotBuffer } from "./network/interpolation";
import type { LobbyPlayer } from "./network/protocol";
import type { InputAppliedMessage } from "./network/protocol";
import { RenderSettings } from "./rendering/RenderSettings";
import { SceneBoundary, SceneLoading } from "./rendering/SceneBoundary";
import { RenderDiagnostics } from "./rendering/RenderDiagnostics";
import { CanvasRecovery } from "./rendering/CanvasRecovery";

import { TrackProvider } from "./track/TrackContext";
import { TRACK_CATALOG, type TrackId } from "./track/trackCatalog";

export function Game({ singlePlayer = false }: { singlePlayer?: boolean }) {
  const [selectedTrackId, setSelectedTrackId] = useState<TrackId>("meadow");
  const [cameraMode, setCameraMode] = useState<"drive" | "inspect">("drive");
  const [ready, setReady] = useState(false);
  const [telemetry, setTelemetry] = useState<KartTelemetry>(INITIAL_KART_TELEMETRY);
  const runtimeRef = useRef(createKartRuntimeState());
  const raceCommandsRef = useRef(createRaceCommands());
  const hostRoom = useHostRoom();
  const trackId = hostRoom.state.roomId ? hostRoom.state.trackId : selectedTrackId;
  const track = TRACK_CATALOG[trackId];
  const keyboardInputRef = useKeyboardInput(singlePlayer && hostRoom.state.roomId === null && cameraMode === "drive");
  const inputReceiptRef = useRef<InputAppliedMessage | null>(null);
  const multiplayerActive = !singlePlayer || hostRoom.state.roomId !== null;
  const overview = multiplayerActive ? hostRoom.state.players.length === 0 : cameraMode === "inspect";
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
    <TrackProvider id={trackId}><div data-track-id={trackId} className="game-canvas" data-follow-player={hostRoom.state.playerId ?? undefined}>
      <RenderSettings>{(quality) => <SceneBoundary><SceneLoading /><Canvas
        camera={{ position: [62, 65, 72], fov: 44, near: 0.1, far: 240 }}
        dpr={quality === "low" ? 1 : [1, 1.5]}
        gl={{ antialias: true }}
        shadows={quality === "standard"}
      >
        <color args={[track.sky]} attach="background" />
        <fog args={[track.sky, overview ? 260 : 70, overview ? 650 : 165]} attach="fog" />
        <RenderDiagnostics />
        <CanvasRecovery />
        <Suspense key={trackId} fallback={null}>
          {multiplayerActive ? (
            <MultiplayerScene
              followPlayerId={hostRoom.state.playerId ?? (hostRoom.state.mode === "solo-phone"
                ? hostRoom.state.players.find((player) => !player.isBot)?.id : undefined)}
              players={hostRoom.state.players}
              snapshotsRef={hostRoom.snapshotsRef}
            />
          ) : <GameScene
            cameraMode={cameraMode}
            inputReceiptRef={inputReceiptRef}
            inputEnabled={cameraMode === "drive"}
            inputRef={keyboardInputRef}
            onInputApplied={() => undefined}
            raceCommandsRef={raceCommandsRef}
            onReady={handleReady}
            onTelemetry={handleTelemetry}
            runtimeRef={runtimeRef}
          />}
        </Suspense>
        {!multiplayerActive && cameraMode === "inspect" ? (
          <OrbitControls
            enableDamping
            enablePan
            maxDistance={140}
            maxPolarAngle={Math.PI / 2.04}
            minDistance={12}
            minPolarAngle={Math.PI / 8}
            target={[0, 0.5, 0]}
          />
        ) : null}
      </Canvas></SceneBoundary>}</RenderSettings>
      {multiplayerActive ? (
        <MultiplayerHud
          hasConnectedHuman={hostRoom.state.players.some((player) => !player.isBot && player.connection === "connected")}
          onReturnLobby={hostRoom.returnLobby}
          onRematch={hostRoom.rematch}
          snapshot={hostRoom.state.snapshot}
          roomPhase={hostRoom.state.phase}
        />
      ) : <GameHud
        cameraMode={cameraMode}
        onRestart={handleRestart}
        onToggleCamera={toggleCamera}
        ready={ready}
        telemetry={telemetry}
      />}
      <CourseMap
        runtimeRef={multiplayerActive ? undefined : runtimeRef}
        snapshotsRef={multiplayerActive ? hostRoom.snapshotsRef : undefined}
        playerId={hostRoom.state.playerId ?? undefined}
      />
      <HostRoomPanel
        selectedTrackId={selectedTrackId}
        onSelectTrack={setSelectedTrackId}
        onClose={() => void hostRoom.closeRoom()}
        onCreate={(mode, hostPlays) => void hostRoom.createRoom(mode, hostPlays, selectedTrackId)}
        onStart={hostRoom.startRace}
        state={hostRoom.state}
      />
      {hostRoom.state.roomId && hostRoom.state.playerId !== null ?
        <KeyboardRaceControls state={hostRoom.state} sendInput={hostRoom.sendInput} useItem={hostRoom.useItem} /> : null}
      {multiplayerActive ? <RaceAudioControls roomId={hostRoom.state.roomId} snapshot={hostRoom.state.snapshot} /> : null}
    </div></TrackProvider>
  );
}


export const PlayerGame = memo(function PlayerGame({ players, snapshotsRef, playerId, trackId }: {
  players: readonly LobbyPlayer[];
  snapshotsRef: RefObject<SnapshotBuffer>;
  playerId: string;
  trackId: TrackId;
}) {
  const track = TRACK_CATALOG[trackId];
  return <TrackProvider id={trackId}><div data-track-id={trackId} className="player-game" data-testid="player-game" data-follow-player={playerId}>
    <RenderSettings initialQuality="low">{(quality) => <SceneBoundary><SceneLoading /><Canvas
      camera={{ position: [62, 65, 72], fov: 44, near: 0.1, far: 240 }}
      dpr={quality === "low" ? 1 : [1, 1.5]} shadows={quality === "standard"}>
      <color args={[track.sky]} attach="background" />
      <fog args={[track.sky, 70, 165]} attach="fog" />
      <RenderDiagnostics /><CanvasRecovery />
      <Suspense key={trackId} fallback={null}><MultiplayerScene players={players} snapshotsRef={snapshotsRef} followPlayerId={playerId} /></Suspense>
    </Canvas></SceneBoundary>}</RenderSettings>
    <CourseMap snapshotsRef={snapshotsRef} playerId={playerId} />
  </div></TrackProvider>;
});
