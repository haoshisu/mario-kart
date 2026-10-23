import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, type Group } from "three";
import { useTrack } from "../track/TrackContext";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import { MeadowScenery } from "./MeadowScenery";

type Prop = { x: number; z: number; size: number; yaw: number };
function usePlacements() {
  const track = useTrack();
  return useMemo(() => track.samples.flatMap((sample, i) => {
    // Keep scenery density within the same mobile budget as course length grows.
    const stride = Math.max(11, Math.ceil(track.samples.length / 36));
    if (i % stride) return [];
    return [-1, 1].flatMap((side) => {
      const [x, z] = pointAtTrackOffset(sample, side * (9 + i % 4));
      return [track.samples, ...track.branches.map(branch => branch.samples)].every(road => distanceToTrack(x, z, road, { closed: road === track.samples }) > 7.8)
        ? [{ x, z, size: 1 + i % 4 * .25, yaw: i * .73 }] : [];
    });
  }), [track]);
}

function Harbor({ props }: { props: Prop[] }) {
  const track = useTrack();
  const beacon = pointAtTrackOffset(track.samples[Math.round(track.samples.length * .18)], 14);
  return <group>
    {/* A skyline behind the circuit and staggered cargo stacks at the quay. */}
    <Instances frames={1} limit={15 + props.length + Math.ceil(props.length / 3)} castShadow receiveShadow>
      <boxGeometry /><meshStandardMaterial roughness={.68} metalness={.22} />
      {Array.from({ length: 15 }, (_, i) => <Instance key={`tower-${i}`} position={[track.bounds.centerX - 63 + i * 9, 5 + i % 5 * 2, track.bounds.centerZ - track.bounds.depth / 2 - 20 - i % 3 * 4]}
        scale={[5 + i % 3, 10 + i % 5 * 4, 5]} color={i % 2 ? "#364777" : "#526192"} />)}
      {props.map(({ x, z, size, yaw }, i) => <group key={i} position={[x, 0, z]} rotation={[0, yaw, 0]}>
        <Instance position={[0, size * .7, 0]} scale={[3, size * 1.4, 1.8]} color={["#cf508a", "#258f9d", "#dc9444"][i % 3]} />
        {i % 3 === 0 ? <Instance position={[.2, size * 2.1, 0]} scale={[3, size * 1.4, 1.8]} color="#6179a8" /> : null}
      </group>)}
    </Instances>
    <Instances frames={1} limit={75 + props.length}>
      <boxGeometry /><meshStandardMaterial color="#8efaff" emissive="#47dce9" emissiveIntensity={2} toneMapped={false} />
      {Array.from({ length: 15 }, (_, i) => Array.from({ length: 5 }, (_, row) => <Instance key={`${i}-${row}`}
        position={[track.bounds.centerX - 63 + i * 9, 2 + row * (1.6 + i % 5 * .6), track.bounds.centerZ - track.bounds.depth / 2 - 17.4 - i % 3 * 4]} scale={[3.8, .25, .08]} />))}
      {props.map(({ x, z, yaw }, i) => <Instance key={`cargo-${i}`} position={[x, .3, z]} rotation={[0, yaw, 0]} scale={[3.2, .1, 2]} />)}
    </Instances>
    <mesh position={[4, .006, 29]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[8, 48]} /><meshStandardMaterial color="#106b97" metalness={.6} roughness={.23} />
    </mesh>
    <group position={[4, 0, 29]}>
      <mesh position={[0, 1.1, 0]} scale={[2, .6, 4]}><sphereGeometry args={[1, 12, 6]} /><meshStandardMaterial color="#e6d8ee" /></mesh>
      <mesh position={[0, 2, -.6]}><boxGeometry args={[2, 1.8, 3]} /><meshStandardMaterial color="#384665" /></mesh>
      <mesh position={[0, 3, -.6]}><boxGeometry args={[2.2, .15, 3.2]} /><meshStandardMaterial color="#ef70bf" emissive="#ef70bf" emissiveIntensity={.8} /></mesh>
    </group>
    {[-40, 33].map((x) => <group key={x} position={[x, 0, track.bounds.centerZ - track.bounds.depth / 2 - 14]}>
      <mesh position={[0, 6, 0]} castShadow><boxGeometry args={[.8, 12, .8]} /><meshStandardMaterial color="#e4a947" /></mesh>
      <mesh position={[3, 11.5, 0]} castShadow><boxGeometry args={[10, .65, .7]} /><meshStandardMaterial color="#e4a947" /></mesh>
      <mesh position={[7, 8, 0]}><boxGeometry args={[.08, 7, .08]} /><meshStandardMaterial color="#aec4dc" /></mesh>
      <mesh position={[7, 4.8, 0]}><boxGeometry args={[2, .3, .8]} /><meshStandardMaterial color="#ffde82" /></mesh>
    </group>)}
    <group position={[beacon[0], 0, beacon[1]]}>
      <mesh position={[0, 7, 0]} castShadow><cylinderGeometry args={[1.7, 2.4, 14, 12]} /><meshStandardMaterial color="#ebd9e8" /></mesh>
      <mesh position={[0, 12, 0]}><cylinderGeometry args={[2, 2, 1.5, 12]} /><meshStandardMaterial color="#eb568c" /></mesh>
      <mesh position={[0, 15, 0]}><cylinderGeometry args={[1.8, 1.8, 2, 12]} /><meshStandardMaterial color="#bafaff" emissive="#50cfdf" emissiveIntensity={2} toneMapped={false} /></mesh>
      <mesh position={[0, 16.7, 0]}><coneGeometry args={[2.6, 1.5, 12]} /><meshStandardMaterial color="#d84279" /></mesh>
    </group>
  </group>;
}

function Canyon({ props }: { props: Prop[] }) {
  const track = useTrack();
  return <group>
    <Instances frames={1} limit={Math.ceil(props.length / 2) * 3 + 9} castShadow receiveShadow>
      <cylinderGeometry args={[.75, 1, 1, 7]} /><meshStandardMaterial roughness={1} flatShading />
      {props.filter((_, i) => i % 2 === 0).map(({ x, z, size, yaw }, i) => <group key={i} position={[x, 0, z]} rotation={[0, yaw, 0]}>
        {[0, 1, 2].map((tier) => <Instance key={tier} position={[tier * .15, size * (1 + tier * 1.7), 0]}
          scale={[size * (1.5 - tier * .22), size * 2, size * (1.5 - tier * .22)]} color={["#bd6049", "#df8c60", "#f1af77"][tier]} />)}
      </group>)}
      {Array.from({ length: 9 }, (_, i) => <Instance key={`mesa-${i}`} position={[-62 + i * 15, 6 + i % 3 * 2, -38 - i % 2 * 6]}
        scale={[6 + i % 2 * 2, 12 + i % 3 * 4, 7]} color={i % 2 ? "#c86b54" : "#e78d66"} />)}
    </Instances>
    <Instances frames={1} limit={Math.floor(props.length / 2) * 3} castShadow>
      <capsuleGeometry args={[.3, 1, 4, 6]} /><meshStandardMaterial color="#46897a" roughness={.9} />
      {props.filter((_, i) => i % 2 === 1).map(({ x, z, size }, i) => <group key={i} position={[x, 0, z]}>
        <Instance position={[0, 1.5 * size, 0]} scale={[size, size * 2, size]} />
        <Instance position={[.65 * size, 1.2 * size, 0]} rotation={[0, 0, Math.PI / 2]} scale={[size, size * .7, size]} />
        <Instance position={[1.05 * size, 1.7 * size, 0]} scale={[size * .7, size, size * .7]} />
      </group>)}
    </Instances>
    <group position={[24, 0, -26]}>
      {[-7, 7].map((x) => <mesh key={x} position={[x, 5.5, 0]} castShadow rotation={[0, 0, -Math.sign(x) * .1]}>
        <cylinderGeometry args={[2.5, 3.3, 11, 7]} /><meshStandardMaterial color="#c37453" flatShading /></mesh>)}
      <mesh position={[0, 10.3, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.2, 2.8, 15, 7]} /><meshStandardMaterial color="#edab73" flatShading /></mesh>
    </group>
    {[-1, 1].map((side) => <group key={side} position={[track.bounds.centerX + side * (track.bounds.width / 2 + 12), 0, 20]}>
      {[0, 1, 2].map((i) => <group key={i} position={[0, 0, i * 7]}>
        <mesh position={[0, 2 + i * .5, 0]} castShadow><boxGeometry args={[5, 4 + i, 4]} /><meshStandardMaterial color={i % 2 ? "#efc795" : "#dc9469"} /></mesh>
        <mesh position={[0, 4.1 + i, 0]}><boxGeometry args={[5.5, .4, 4.5]} /><meshStandardMaterial color="#854654" /></mesh>
      </group>)}
    </group>)}
  </group>;
}

function AuroraRibbon() {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => { if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * .18) * .025; });
  return <group ref={group} position={[0, 28, -39]}>
    {[0, 1, 2].map((layer) => <mesh key={layer} position={[0, layer * 3, layer * -4]} rotation={[.25, 0, layer % 2 ? .14 : -.08]} scale={[3.8, 1, 1]}>
      <torusGeometry args={[15, .8 + layer * .2, 4, 64, Math.PI]} />
      <meshBasicMaterial color={["#64ffcd", "#75d6ff", "#bd8dff"][layer]} transparent opacity={.28} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} />
    </mesh>)}
  </group>;
}
function Aurora({ props }: { props: Prop[] }) {
  const track = useTrack();
  const crystal = pointAtTrackOffset(track.samples[Math.round(track.samples.length * .7)], 18);
  return <group>
    <AuroraRibbon />
    <Instances frames={1} limit={props.length * 3} castShadow>
      <coneGeometry args={[1, 1, 5]} /><meshStandardMaterial roughness={.32} metalness={.15} emissive="#479aa9" emissiveIntensity={.25} />
      {props.map(({ x, z, size, yaw }, i) => <group key={i} position={[x, 0, z]} rotation={[0, yaw, 0]}>
        <Instance position={[0, size * 2.5, 0]} scale={[size, size * 5, size]} color={i % 2 ? "#85cde3" : "#b7a8ef"} />
        <Instance position={[size, size * 1.2, .3]} rotation={[0, 0, -.3]} scale={[size * .55, size * 2.4, size * .55]} color="#b4f3f2" />
        <Instance position={[-size * .6, size, .5]} rotation={[0, 0, .3]} scale={[size * .5, size * 2, size * .5]} color="#e3edff" />
      </group>)}
    </Instances>
    <Instances frames={1} limit={36} receiveShadow>
      <coneGeometry args={[1, 1, 6]} /><meshStandardMaterial roughness={.86} flatShading />
      {Array.from({ length: 12 }, (_, i) => <group key={i} position={[-68 + i * 12, 0, -37 - i % 3 * 5]}>
        <Instance position={[0, 7 + i % 4 * 2, 0]} scale={[8, 14 + i % 4 * 4, 8]} color="#5b94b1" />
        <Instance position={[0, 12 + i % 4 * 3.5, 0]} scale={[3, 5 + i % 4, 3]} color="#e7f6ff" />
      </group>)}
    </Instances>
    <mesh position={[20, .01, 23]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[6, 48]} /><meshStandardMaterial color="#6ac2d4" metalness={.45} roughness={.18} /></mesh>
    <group position={[crystal[0], 0, crystal[1]]}>
      <mesh position={[0, 8, 0]}><octahedronGeometry args={[7]} /><meshStandardMaterial color="#a9f8ef" emissive="#47b5af" emissiveIntensity={.65} metalness={.4} roughness={.2} /></mesh>
      <mesh position={[0, 1, 0]}><cylinderGeometry args={[7, 8, 2, 8]} /><meshStandardMaterial color="#d4eaf7" /></mesh>
    </group>
  </group>;
}

export function ThemedScenery() {
  const track = useTrack();
  const props = usePlacements();
  return <group>
    <MeadowScenery themed />
    {track.id === "harbor" ? <Harbor props={props} /> : track.id === "canyon" ? <Canyon props={props} /> : <Aurora props={props} />}
  </group>;
}
