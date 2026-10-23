import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useTrack } from "../track/TrackContext";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";

const COLORS = { tainan: ["#edb987", "#b98570"], taichung: ["#96d5bc", "#e9c99b"], taipei: ["#73daca", "#f8c77d"], jiufen: ["#dc9068", "#ffd69d"], kaohsiung: ["#71cbbd", "#e9b974"], alishan: ["#90c17b", "#e4be79"], forest: ["#b9e690", "#ffcf7e"], clockwork: ["#edb96d", "#86e9df"], volcano: ["#ff986b", "#cbb0e5"], meadow: ["#ffaebf", "#ffe284"], harbor: ["#52e8ef", "#ff89ce"], canyon: ["#edab69", "#83ce9a"], aurora: ["#b3a5ff", "#9ffff0"] } as const;

/** Small original spectators stay outside the guardrails; no invisible obstacles. */
export function TracksideResidents() {
  const track = useTrack();
  const animated = useRef<Group>(null);
  const spots = useMemo(() => track.samples.flatMap((sample, i) => {
    if (i % 43 !== 10) return [];
    const [x, z] = pointAtTrackOffset(sample, (i % 2 ? 1 : -1) * 8);
    return [track.samples, ...track.branches.map(branch => branch.samples)].every(road => distanceToTrack(x, z, road, { closed: road === track.samples }) > 7)
      ? [{ x, z, y: Math.max(0, sample.height), yaw: i }] : [];
  }), [track]);
  useFrame(({ clock }) => {
    animated.current?.children.forEach((child, i) => {
      child.rotation.z = Math.sin(clock.elapsedTime * 1.8 + i) * .09;
    });
  });
  const colors = COLORS[track.id];
  return <group ref={animated} name={`${track.id}-spectators`}>
    {spots.map(({ x, y, z, yaw }, i) => <group key={i} position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, .2, 0]}><cylinderGeometry args={[1.15, 1.4, .4, 8]} /><meshStandardMaterial color={colors[1]} /></mesh>
      <mesh position={[0, 1.2, 0]} scale={[1, 1.2, .8]} castShadow>
        {track.id === "harbor" ? <boxGeometry args={[1.5, 1.5, 1.4]} /> : <sphereGeometry args={[.85, 12, 8]} />}
        <meshStandardMaterial color={colors[0]} roughness={.55} />
      </mesh>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * .28, 1.5, .65]}><sphereGeometry args={[.12, 8, 6]} /><meshBasicMaterial color="#193746" /></mesh>
        <mesh position={[side * .65, 2.1, 0]} rotation={[0, 0, -side * .3]}>
          {track.id === "meadow" ? <sphereGeometry args={[.45, 8, 6]} /> : <coneGeometry args={[.3, .85, 5]} />}
          <meshStandardMaterial color={colors[1]} emissive={colors[1]} emissiveIntensity={track.id === "aurora" ? .5 : .05} />
        </mesh>
      </group>)}
      {track.id === "meadow" ? <mesh position={[0, 2.25, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.9, .28, 6, 10]} /><meshStandardMaterial color="#ffccda" /></mesh> : null}
      {track.id === "harbor" ? <mesh position={[0, 2.5, 0]}><sphereGeometry args={[.22, 8, 6]} /><meshStandardMaterial color="#fff5a3" emissive="#fff5a3" emissiveIntensity={2} /></mesh> : null}
    </group>)}
  </group>;
}
