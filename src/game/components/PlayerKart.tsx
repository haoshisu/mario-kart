import type { CharacterId } from "../entities/characters";
import { sampleDrivingSurface } from "../track/drivingSurface";
import { applyRampSurface } from "../core/stunts/stuntSystem";
import { useTrack } from "../track/TrackContext";
import { roadOrientation, createSurfaceResult } from "../track/trackSurface";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group } from "three";
import { KART_CONFIG, KART_WHEEL_POSITIONS } from "../core/kart/kartConfig";
import { createKartVisualDynamics, stepKartVisualDynamics, createKartSurfaceDynamics, stepKartSurfaceDynamics } from "../assets/kartVisualDynamics";
import { KartBodyModel, KartWheelModel } from "../assets/KartModel";
import { PLAYER_COLOR_VALUES } from "../network/networkConfig";
import { SnapshotBuffer } from "../network/interpolation";
import type { PlayerColor } from "../network/networkConfig";
import { MultiplayerKartEffects } from "./MultiplayerKartEffects";
import { PlayerNameplate } from "./PlayerNameplate";
import { SlipstreamEffects } from "./SlipstreamEffects";

type PlayerKartProps = {
  playerId: string;
  nickname: string;
  color: PlayerColor;
  characterId: CharacterId;
  snapshotsRef: RefObject<SnapshotBuffer>;
};

export function PlayerKart({ playerId, nickname, color, characterId, snapshotsRef }: PlayerKartProps) {
  const track = useTrack();
  const surface = useRef(createSurfaceResult());
  const groupRef = useRef<Group>(null);
  const visualRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const dynamics = useRef(createKartVisualDynamics());
  const roadDynamics = useRef(createKartSurfaceDynamics());
  const wasAirborne = useRef(false);
  const lastImpactRef = useRef(0);
  const motionRef = useRef({ speed: 0, steer: 0, finished: false });

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const visual = visualRef.current;
    const player = snapshotsRef.current?.sampleFrame(clock.elapsedTime)?.players.find((entry) => entry.id === playerId);
    if (!group || !visual || !player) {
      return;
    }
    const resetDynamics = player.status !== "racing" ||
      (group.position.x - player.position[0]) ** 2 + (group.position.z - player.position[2]) ** 2 > 25;
    group.position.set(...player.position);
    applyRampSurface(player.position[0], player.position[2], track.ramps, sampleDrivingSurface(player.position[0], player.position[2], track, surface.current, player.position[1] - .52));
    const { pitch, roll } = roadOrientation(player.yaw, surface.current);
    const airborne = player.stuntProgress > 0;
    stepKartSurfaceDynamics(roadDynamics.current, airborne ? 0 : pitch, airborne ? 0 : roll,
      delta, resetDynamics || airborne || wasAirborne.current !== airborne);
    wasAirborne.current = airborne;
    group.rotation.set(roadDynamics.current.pitch, player.yaw, roadDynamics.current.roll, "YXZ");
    motionRef.current.speed = player.speed;
    motionRef.current.steer = player.steer;
    motionRef.current.finished = player.status === "finished";
    const impact = player.impactRevision !== lastImpactRef.current ? 1 : 0;
    lastImpactRef.current = player.impactRevision;
    stepKartVisualDynamics(dynamics.current, player.speed, player.steer, player.drifting,
      player.stuntProgress > 0, impact, delta, resetDynamics);
    visual.rotation.z = player.stuntProgress > 0 ? Math.PI * 2 * player.stuntProgress : 0;
    const body = bodyRef.current;
    if (body) {
      body.rotation.set(dynamics.current.pitch, 0, dynamics.current.roll);
      body.position.y = dynamics.current.sink;
    }
  });

  return (
    <group ref={groupRef}>
      <group scale={KART_CONFIG.modelScale} position={[0, -0.43 * (1 - KART_CONFIG.modelScale), 0]}>
      <group ref={visualRef}>
        <group ref={bodyRef}><KartBodyModel characterId={characterId} color={PLAYER_COLOR_VALUES[color]} motionRef={motionRef} /></group>
      {KART_WHEEL_POSITIONS.map((position, index) => <KartWheelModel key={index} position={position} motionRef={motionRef} />)}
      </group>
      <MultiplayerKartEffects playerId={playerId} snapshotsRef={snapshotsRef} />
      <SlipstreamEffects playerId={playerId} snapshotsRef={snapshotsRef} />
      </group>
      <PlayerNameplate nickname={nickname} />
    </group>
  );
}
