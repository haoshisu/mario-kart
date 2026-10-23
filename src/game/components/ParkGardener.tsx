import { isTaiwanTrack } from "../track/taiwanTracks";
import { TaiwanObstacleModel } from "./TaiwanProps";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import type { Group } from "three";
import type { SnapshotBuffer } from "../network/interpolation";
import { NETWORK_CONFIG } from "../network/networkConfig";
import { createParkObstacle, parkObstaclePose, parkObstacleYaw } from "../track/parkObstacle";
import { useTrack } from "../track/TrackContext";

export function GardenerCart() {
  return <group>
    <mesh castShadow><boxGeometry args={[1.5, .7, 2]} /><meshStandardMaterial color="#ffc167" roughness={.7} /></mesh>
    <mesh position={[0, .42, .25]}><boxGeometry args={[1.55, .18, 1.4]} /><meshStandardMaterial color="#50c898" /></mesh>
    {[-.8, .8].flatMap(x => [-.65, .65].map(z => <mesh key={`${x}:${z}`} position={[x, -.35, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.32, .32, .2, 8]} /><meshStandardMaterial color="#243d4b" /></mesh>))}
    {[-.45, 0, .45].map(x => <mesh key={x} position={[x, .65, .4]}><sphereGeometry args={[.32, 8, 6]} /><meshStandardMaterial color={x ? "#fb78b0" : "#ffe486"} /></mesh>)}
    <mesh position={[0, .9, -.5]}><sphereGeometry args={[.35, 10, 6]} /><meshStandardMaterial color="#a8ead5" /></mesh>
    <mesh position={[0, 1.22, -.5]}><coneGeometry args={[.48, .3, 8]} /><meshStandardMaterial color="#df6489" /></mesh>
    <mesh position={[0, 1.1, -.83]}><boxGeometry args={[.23, .1, .07]} /><meshStandardMaterial color="#183d4d" /></mesh>
  </group>;
}
/** The visible cart uses the same per-room tick and pose function as Rapier. */
export function ParkGardener({ snapshotsRef }: { snapshotsRef: RefObject<SnapshotBuffer> }) {
  const track = useTrack();
  const obstacle = useMemo(() => createParkObstacle(track.race.RACE_ROUTE_SAMPLES, track.id, track.branches.find(branch => branch.id === "taipei-crossing")?.samples), [track]);
  const group = useRef<Group>(null), pose = useRef({ x: 0, y: 0, z: 0 });
  useFrame(({ clock }) => {
    if (!group.current) return;
    const snapshot = snapshotsRef.current.sampleFrame(clock.elapsedTime);
    parkObstaclePose(obstacle, snapshot ? snapshot.tick / NETWORK_CONFIG.simulationRateHz : 0, pose.current);
    group.current.position.set(pose.current.x, pose.current.y, pose.current.z);
    group.current.rotation.y = parkObstacleYaw(obstacle, snapshot ? snapshot.tick / NETWORK_CONFIG.simulationRateHz : 0);
  });
  return <group ref={group} rotation={[0, obstacle.yaw, 0]}><ParkObstacleModel /></group>;
}

export function ParkObstacleModel() {
  const track = useTrack();
  if (isTaiwanTrack(track.id)) return <TaiwanObstacleModel id={track.id} />;
  if (track.id === "meadow") return <GardenerCart />;
  const color = { tainan: "#df9a69", taichung: "#8ac8ab", meadow: "#ffc167", harbor: "#f3ad53", canyon: "#9e6359", aurora: "#a0e6ee", forest: "#a6d673", clockwork: "#daa658", volcano: "#ec875b" }[track.id];
  return <group name={`${track.id}-moving-obstacle`}>
    <mesh castShadow><boxGeometry args={[1.5, .7, 2]} /><meshStandardMaterial color={color} /></mesh>
    {[-.8, .8].flatMap(x => [-.65, .65].map(z => <mesh key={`${x}:${z}`} position={[x, -.35, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[.32, .32, .2, 8]} /><meshStandardMaterial color="#243d4b" /></mesh>))}
    <mesh position={[0, .6, .25]}><boxGeometry args={[1.2, .5, 1.2]} /><meshStandardMaterial color={track.id === "canyon" ? "#dd9363" : "#456a8b"} /></mesh>
    <mesh position={[0, .95, -.55]}><sphereGeometry args={[.3, 10, 6]} /><meshStandardMaterial color="#d6fff2" /></mesh>
    <mesh position={[0, .98, -.83]}><boxGeometry args={[.38, .09, .06]} /><meshBasicMaterial color="#68e7ec" /></mesh>
    <mesh position={[0, 1.3, -.55]}><sphereGeometry args={[.12, 8, 5]} /><meshBasicMaterial color="#ffda67" /></mesh>
  </group>;
}
