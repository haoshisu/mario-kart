import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { TRACK_SAMPLES, pointAtTrackOffset, distanceToTrack } from "../track/trackPath";
import { Instance, Instances } from "@react-three/drei";

type Prop = {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
};

// Deterministic placements stay outside the driving ribbon. Shared geometry
// keeps the richer silhouette inexpensive on four-player mobile screens.
const CLOUDS: Prop[] = Array.from({ length: 12 }, (_, i) => {
  const angle = i * Math.PI / 6;
  return { position: [Math.cos(angle) * 58, 18 + i % 3 * 3, Math.sin(angle) * 48], scale: [6, 1.6, 2.5], color: "#ffffff" };
});
const FLOWERS: Prop[] = TRACK_SAMPLES.flatMap((sample, i) => {
  if (i % 3 !== 0) return [];
  return [-1, 1].flatMap((side) => {
    const [x, z] = pointAtTrackOffset(sample, side * 6.1);
    if (distanceToTrack(x, z) < 5.8) return [];
    return [{ position: [x, .18, z] as [number, number, number], scale: [.18, .20, .18] as [number, number, number], color: ["#fff7cd", "#ffb52e", "#ff749d"][Math.floor(i / 3) % 3] }];
  });
});
const BALLOONS: Prop[] = [
  { position: [-24, 15, -28], scale: [2.8, 3.7, 2.8], color: "#ffb52e" },
  { position: [55, 18, 25], scale: [3.3, 4.4, 3.3], color: "#ff7394" },
  { position: [5, 23, 48], scale: [2.5, 3.4, 2.5], color: "#39c8d5" },
];
const RIDGES: Prop[] = Array.from({ length: 14 }, (_, i) => {
  const angle = i * Math.PI / 7;
  return { position: [Math.cos(angle) * 78, -3, Math.sin(angle) * 65], scale: [10, 9 + i % 4 * 3, 9], color: i % 2 ? "#57b89d" : "#79cbb0" };
});
const ROUND_PROPS = [...CLOUDS, ...FLOWERS, ...BALLOONS, ...RIDGES];
const FLAGS: Prop[] = Array.from({ length: 20 }, (_, i) => ({
  position: [-11.4 + i * 1.2, 3.3, -18],
  scale: [.8, .48, .07], color: ["#ff758d", "#ffd44b", "#27bfce", "#fcf4cf"][i % 4],
}));
const POSTS: Prop[] = FLAGS.map(({ position: [x, , z] }) => ({ position: [x, 1.7, z], scale: [.07, 3.4, .07], color: "#fff4dc" }));
const BASKETS: Prop[] = BALLOONS.map(({ position: [x, y, z], scale }) => ({ position: [x, y - scale[1] - 1, z], scale: [.9, .65, .9], color: "#bc783d" }));
const BOX_PROPS = [...FLAGS, ...POSTS, ...BASKETS];

function Windmill() {
  const blades = useRef<Group>(null);
  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.z = (blades.current.rotation.z + Math.min(delta, .1) * .28) % (Math.PI * 2);
  });
  return <group position={[0, 0, 1]}>
    <mesh castShadow position={[0, 2.4, 0]}>
      <cylinderGeometry args={[1.1, 1.65, 4.8, 16]} />
      <meshStandardMaterial color="#fff2cf" roughness={.9} />
    </mesh>
    <mesh castShadow position={[0, 5.3, 0]}>
      <coneGeometry args={[1.6, 1.8, 16]} />
      <meshStandardMaterial color="#f27759" />
    </mesh>
    <group ref={blades} position={[0, 3.8, -1.2]} rotation={[0, 0, .35]}>
      <Instances frames={1} limit={8} castShadow>
        <boxGeometry /><meshStandardMaterial roughness={.8} />
        {[0, 1, 2, 3].map((i) => <group key={i} rotation={[0, 0, i * Math.PI / 2]}>
          <Instance position={[0, 1.3, 0]} scale={[.12, 2.8, .14]} color="#b97742" />
          <Instance position={[.27, 1.7, -.08]} scale={[.65, 1.6, .08]} color="#fff8e1" />
        </group>)}
      </Instances>
      <mesh><sphereGeometry args={[.28, 12, 8]} /><meshStandardMaterial color="#ffd45c" /></mesh>
    </group>
    {[-1, 1].map((side) => <mesh key={side} position={[side * .65, 2.1, -1.19]}>
      <boxGeometry args={[.38, .7, .12]} /><meshStandardMaterial color="#3297b5" />
    </mesh>)}
  </group>;
}

export function FestivalScenery() {
  return <group>
    <Instances frames={1} limit={ROUND_PROPS.length}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial roughness={.9} />
      {ROUND_PROPS.map((prop, i) => <Instance key={i} {...prop} />)}
    </Instances>
    <Instances frames={1} limit={BOX_PROPS.length}>
      <boxGeometry />
      <meshStandardMaterial roughness={.85} />
      {BOX_PROPS.map((prop, i) => <Instance key={i} {...prop} />)}
    </Instances>
    <Windmill />
  </group>;
}
