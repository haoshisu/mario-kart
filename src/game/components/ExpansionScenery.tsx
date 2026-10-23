import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { useTrack } from "../track/TrackContext";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";

type ExpansionId = "forest" | "clockwork" | "volcano";
export function ExpansionLandmark({ id, position }: { id: ExpansionId; position: [number, number, number] }) {
  const motion = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (!motion.current) return;
    if (id === "forest") motion.current.rotation.z = Math.sin(clock.elapsedTime * .65) * .018;
    else motion.current.rotation.z += Math.min(delta, .05) * .22;
  });
  return <group position={position} name={`${id}-major-landmark`}>
    {id === "forest" ? <>
      <mesh position={[0,18,0]} castShadow><cylinderGeometry args={[3,7,36,9]} /><meshStandardMaterial color="#795739" /></mesh>
      <group ref={motion} position={[0,35,0]}>
        {[-1,0,1].map(i => <mesh key={i} position={[i*10,Math.abs(i)*-4,0]} scale={[13,9,12]} castShadow><sphereGeometry args={[1,12,8]} /><meshStandardMaterial color={i ? "#43895a" : "#73b767"} /></mesh>)}
        <mesh position={[0,-8,9]}><boxGeometry args={[9,5,7]} /><meshStandardMaterial color="#dbad6f" /></mesh>
        <mesh position={[0,-4,9]}><coneGeometry args={[8,4,4]} /><meshStandardMaterial color="#ffba7a" /></mesh>
      </group>
      <mesh position={[0,22,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[9,.6,8,32]} /><meshStandardMaterial color="#d8b97c" /></mesh>
    </> : id === "clockwork" ? <>
      <mesh position={[0,19,0]} castShadow><boxGeometry args={[12,38,9]} /><meshStandardMaterial color="#876b55" /></mesh>
      <mesh position={[0,39,0]}><coneGeometry args={[10,7,4]} /><meshStandardMaterial color="#79c2bf" /></mesh>
      <group ref={motion} position={[0,29,5]}>
        <mesh><torusGeometry args={[8,.9,8,32]} /><meshStandardMaterial color="#edba6d" metalness={.5} /></mesh>
        {Array.from({length:12},(_,i) => <mesh key={i} position={[Math.cos(i*Math.PI/6)*8,Math.sin(i*Math.PI/6)*8,0]} rotation={[0,0,i*Math.PI/6]}><boxGeometry args={[3,1.5,1.5]} /><meshStandardMaterial color="#efc587" /></mesh>)}
        <mesh position={[0,3,0]}><boxGeometry args={[.5,6,.6]} /><meshBasicMaterial color="#9dffeb" /></mesh>
      </group>
    </> : <>
      <mesh position={[0,17,0]} castShadow><cylinderGeometry args={[9,24,34,12,1,true]} /><meshStandardMaterial color="#57404c" side={2} flatShading /></mesh>
      <mesh position={[0,32,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[9,32]} /><meshBasicMaterial color="#ff9b42" toneMapped={false} /></mesh>
      <group ref={motion} position={[0,36,0]}>
        {Array.from({length:8},(_,i) => <mesh key={i} position={[Math.cos(i*Math.PI/4)*5,Math.sin(i*Math.PI/4)*5,0]}><octahedronGeometry args={[.7]} /><meshBasicMaterial color="#ffd17d" /></mesh>)}
      </group>
    </>}
  </group>;
}

/** Repeated scenery is instanced; animated vegetation and machinery share one group. */
export function ExpansionScenery() {
  const track = useTrack(), animated = useRef<Group>(null);
  const spots = useMemo(() => track.samples.flatMap((sample,i) => {
    if (i % 19) return [];
    return [-1,1].flatMap(side => {
      const [x,z] = pointAtTrackOffset(sample,side*14);
      const clear = [track.samples,...track.branches.map(b => b.samples)].every(road => distanceToTrack(x,z,road,{closed:road === track.samples}) > 10);
      return clear ? [{x,z,y:Math.max(0,sample.height-3),i}] : [];
    });
  }),[track]);
  useFrame(({clock},delta) => {
    animated.current?.children.forEach((child,i) => {
      if (track.id === "forest") child.rotation.z = Math.sin(clock.elapsedTime+i)*.025;
      else child.rotation.y += Math.min(delta,.05)*.3;
    });
  });
  if (track.id === "forest") return <group name="forest-canopy-village">
    <Instances frames={1} limit={spots.length}><cylinderGeometry args={[.7,1.3,8,7]} /><meshStandardMaterial color="#795338" />
      {spots.map((p,i) => <Instance key={i} position={[p.x,p.y+4,p.z]} />)}</Instances>
    <Instances limit={spots.length}><sphereGeometry args={[1,10,6]} /><meshStandardMaterial color="#4c965c" />
      <group ref={animated}>{spots.map((p,i) => <group key={i} position={[p.x,p.y+8,p.z]}><Instance position={[0,1,0]} scale={[4,5,4]} /></group>)}</group></Instances>
  </group>;
  if (track.id === "clockwork") return <group name="clockwork-production-yard">
    <Instances frames={1} limit={spots.length}><boxGeometry /><meshStandardMaterial color="#8a776b" />
      {spots.map((p,i) => <Instance key={i} position={[p.x,p.y+4,p.z]} scale={[7,8,6]} />)}</Instances>
    <group ref={animated}>{spots.filter((_,i)=>i%3===0).map((p,i)=><group key={i} position={[p.x,p.y+9,p.z]}>
      <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[3,.5,6,16]} /><meshStandardMaterial color="#deb275" /></mesh>
      <mesh><boxGeometry args={[7,.6,.6]} /><meshStandardMaterial color="#82e5dc" /></mesh>
    </group>)}</group>
  </group>;
  return <group name="volcano-basalt-fields">
    <Instances frames={1} limit={spots.length}><coneGeometry args={[1,1,6]} /><meshStandardMaterial color="#473841" flatShading />
      {spots.map((p,i) => <Instance key={i} position={[p.x,p.y+4,p.z]} scale={[4,8+p.i%5,4]} />)}</Instances>
    <Instances frames={1} limit={spots.length}><sphereGeometry args={[1,10,6]} /><meshBasicMaterial color="#f97738" toneMapped={false} />
      {spots.map((p,i) => <Instance key={i} position={[p.x,p.y+.1,p.z]} scale={[5,.1,5]} />)}</Instances>
  </group>;
}
