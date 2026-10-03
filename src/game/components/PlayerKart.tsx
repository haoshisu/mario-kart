import { useTrack } from "../track/TrackContext";
import { sampleTrackSurface, roadOrientation, createSurfaceResult } from "../track/trackSurface";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group } from "three";
import { KART_CONFIG, KART_WHEEL_POSITIONS } from "../core/kart/kartConfig";
import { KartBodyModel, KartWheelModel } from "../assets/KartModel";
import { PLAYER_COLOR_VALUES } from "../network/networkConfig";
import { SnapshotBuffer } from "../network/interpolation";
import type { PlayerColor } from "../network/networkConfig";
import { MultiplayerKartEffects } from "./MultiplayerKartEffects";

type PlayerKartProps = {
  playerId: string;
  nickname: string;
  color: PlayerColor;
  snapshotsRef: RefObject<SnapshotBuffer>;
};

export function PlayerKart({ playerId, nickname, color, snapshotsRef }: PlayerKartProps) {
  const track = useTrack();
  const surface = useRef(createSurfaceResult());
  const groupRef = useRef<Group>(null);
  const visualRef = useRef<Group>(null);
  const lastImpactRef = useRef(0);
  const shakeRef = useRef(0);
  const motionRef = useRef({ speed: 0, steer: 0, finished: false });

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const visual = visualRef.current;
    const player = snapshotsRef.current?.sample()?.players.find((entry) => entry.id === playerId);
    if (!group || !visual || !player) {
      return;
    }
    group.position.set(...player.position);
    sampleTrackSurface(player.position[0], player.position[2], track.samples, surface.current);
    const { pitch, roll } = roadOrientation(player.yaw, surface.current);
    group.rotation.set(pitch, player.yaw, roll, "YXZ");
    motionRef.current.speed = player.speed;
    motionRef.current.steer = player.steer;
    motionRef.current.finished = player.status === "finished";
    const targetLean = -player.steer * Math.min(1, Math.abs(player.speed) / 9) *
      (player.drifting ? 0.09 : 0.025);
    visual.rotation.z += (targetLean - visual.rotation.z) *
      (1 - Math.exp(-10 * Math.min(delta, 0.1)));
    if (player.impactRevision !== lastImpactRef.current) {
      lastImpactRef.current = player.impactRevision;
      shakeRef.current = 1;
    }
    shakeRef.current = Math.max(0, shakeRef.current - delta * 4.5);
    visual.rotation.x = Math.sin(clock.elapsedTime * 46) * shakeRef.current * 0.05;
  });

  return (
    <group ref={groupRef}>
      <group scale={KART_CONFIG.modelScale} position={[0, -0.43 * (1 - KART_CONFIG.modelScale), 0]}>
      <group ref={visualRef}>
        <KartBodyModel color={PLAYER_COLOR_VALUES[color]} motionRef={motionRef} />
      </group>
      {KART_WHEEL_POSITIONS.map((position, index) => <KartWheelModel key={index} position={position} motionRef={motionRef} />)}
      <MultiplayerKartEffects playerId={playerId} snapshotsRef={snapshotsRef} />
      </group>
      <Html center position={[0, 1.45, 0]} zIndexRange={[2, 1]} style={{ pointerEvents: "none" }}>
        <span className="player-nameplate">{nickname}</span>
      </Html>
    </group>
  );
}
