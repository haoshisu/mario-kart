import { useMemo } from "react";
import { surfaceTexture, type SurfaceKind } from "../rendering/surfaceTextures";
import { Instance, Instances } from "@react-three/drei";
import type { TaiwanTrackId } from "../track/taiwanTracks";

export type TaiwanBox = { position: readonly [number, number, number]; scale: readonly [number, number, number]; color: string; surface?: SurfaceKind | "glass"; rotation?: readonly [number, number, number] };
export function TaiwanBoxes({ boxes, glow = false }: { boxes: readonly TaiwanBox[]; glow?: boolean }) {
  const groups = useMemo(() => {
    const result = new Map<SurfaceKind | "glass", TaiwanBox[]>();
    for (const box of boxes) { const kind = box.surface ?? "concrete"; const group = result.get(kind) ?? []; group.push(box); result.set(kind, group); }
    return [...result];
  }, [boxes]);
  return <group>{groups.map(([kind, group]) => <Instances key={kind} frames={1} limit={group.length} receiveShadow castShadow={!glow && kind !== "glass"}>
    <boxGeometry />{glow ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial
      map={kind === "glass" ? undefined : surfaceTexture(kind)}
      bumpMap={kind === "glass" || kind === "metal" ? undefined : surfaceTexture(kind)} bumpScale={kind === "brick" ? .075 : .025}
      roughness={kind === "glass" ? .18 : kind === "metal" ? .35 : .9} metalness={kind === "glass" ? .6 : kind === "metal" ? .7 : 0} />}
    {group.map((box, i) => <Instance key={i} position={[...box.position]} scale={[...box.scale]} rotation={box.rotation ? [...box.rotation] : undefined} color={box.color} />)}
  </Instances>)}</group>;
}

export function TaiwanTower() {
  return <group name="taipei-segmented-tower">
    <mesh position={[0,4,0]}><boxGeometry args={[23,8,23]} /><meshStandardMaterial color="#508477" /></mesh>
    {Array.from({length: 8}, (_, i) => <group key={i} position={[0,12+i*7.5,0]}>
      <mesh><cylinderGeometry args={[10-i*.55,8.5-i*.55,7,4]} /><meshStandardMaterial color={i%2 ? "#67afa2" : "#518e85"} metalness={.15} /></mesh>
      <mesh position={[0,3.5,0]}><cylinderGeometry args={[10.2-i*.55,10.2-i*.55,.45,4]} /><meshStandardMaterial color="#b4d7b5" /></mesh>
    </group>)}
    <mesh position={[0,78,0]}><cylinderGeometry args={[.2,1,18,6]} /><meshStandardMaterial color="#e4c98f" /></mesh>
  </group>;
}

export function TaiwanLandmark({ id, variant = 0 }: { id: TaiwanTrackId; variant?: number }) {
  if (id === "taipei") return <TaiwanTower />;
  if (id === "jiufen") return <group name="jiufen-teahouse">
    {[0,1,2].map(tier => <group key={tier} position={[tier*2,tier*5,0]}>
      <mesh position={[0,2.4,0]}><boxGeometry args={[13,4.8,9]} /><meshStandardMaterial color="#875b4b" /></mesh>
      <mesh position={[0,5,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[11,2,4]} /><meshStandardMaterial color="#355c52" /></mesh>
      {[-4,0,4].map(x => <group key={x} position={[x,3.2,4.7]}>
        <mesh><boxGeometry args={[2.4,2.2,.15]} /><meshBasicMaterial color="#ffd196" /></mesh>
        <mesh position={[0,-1.5,.8]} scale={[.65,.85,.65]}><sphereGeometry args={[.6,8,6]} /><meshStandardMaterial color="#d44939" emissive="#a32f28" emissiveIntensity={.6} /></mesh>
      </group>)}
    </group>)}
  </group>;
  if (id === "kaohsiung") return <group name={variant ? "kaohsiung-ocean-roof" : "kaohsiung-white-sail"}>
    {variant ? [0,1,2,3].map(i => <mesh key={i} position={[(i-1.5)*8,5+Math.sin(i)*2,0]} rotation={[0,0,(i-1.5)*.15]}>
      <cylinderGeometry args={[5,5,9,6]} /><meshStandardMaterial color={i%2 ? "#f8e5b8" : "#5aada6"} /></mesh>
    ) : <>
      <mesh position={[0,18,0]} rotation={[0,0,.16]}><cylinderGeometry args={[.45,1.1,36,6]} /><meshStandardMaterial color="#fff0d0" /></mesh>
      {[-1,1].map(side => <mesh key={side} position={[side*5,12,0]} rotation={[0,0,-side*.6]}><coneGeometry args={[7,24,3]} /><meshStandardMaterial color="#e0efe7" /></mesh>)}
      <mesh position={[0,1,0]}><boxGeometry args={[26,2,10]} /><meshStandardMaterial color="#ddd3b6" /></mesh>
    </>}
  </group>;
  return <group name="alishan-giant-cypress">
    <mesh position={[0,18,0]}><cylinderGeometry args={[2.8,5.5,36,9]} /><meshStandardMaterial color="#78583c" /></mesh>
    {[-1,0,1].map(i => <mesh key={i} position={[i*6,32-Math.abs(i)*5,0]} scale={[10,9,10]}><sphereGeometry args={[1,10,6]} /><meshStandardMaterial color={i ? "#37634a" : "#52825a"} /></mesh>)}
    {Array.from({length:6},(_,i)=><mesh key={i} position={[Math.cos(i*Math.PI/3)*5,1,Math.sin(i*Math.PI/3)*5]} rotation={[0,i*Math.PI/3,0]}><boxGeometry args={[11,2,2]} /><meshStandardMaterial color="#896548" /></mesh>)}
  </group>;
}

export function TaiwanObstacleModel({ id }: { id: TaiwanTrackId }) {
  if (id === "kaohsiung") return <group name="hoisted-container-obstacle">
    <mesh><boxGeometry args={[1.7,1.4,3]} /><meshStandardMaterial color="#d87849" /></mesh>
    {[-.7,.7].map(x=><mesh key={x} position={[x,3,0]}><boxGeometry args={[.06,5,.06]} /><meshStandardMaterial color="#333e4a" /></mesh>)}
    {[-1,1].map(z=><mesh key={z} position={[0,0,z]}><boxGeometry args={[1.75,.08,.06]} /><meshStandardMaterial color="#eeb66a" /></mesh>)}
  </group>;
  const train = id !== "jiufen", color = id === "taipei" ? "#65c9bc" : "#c85740";
  return <group name={train ? "rail-obstacle" : "mine-cart-obstacle"}>
    <mesh><boxGeometry args={[train ? 1.4 : 1.5,train ? 1.6 : 1.2,train ? 5 : 2]} /><meshStandardMaterial color={train ? color : "#765847"} /></mesh>
    {train ? <>
      <mesh position={[0,.9,0]}><boxGeometry args={[1.5,.2,5.1]} /><meshStandardMaterial color="#efe6cf" /></mesh>
      {[-1,1].flatMap(side=>[-1.5,0,1.5].map(z=><mesh key={`${side}:${z}`} position={[side*.71,.3,z]}><boxGeometry args={[.025,.65,1]} /><meshStandardMaterial color="#244b55" /></mesh>))}
      <mesh position={[0,.2,-2.51]}><boxGeometry args={[1,.6,.02]} /><meshStandardMaterial color="#274b55" /></mesh>
      {[-.4,.4].map(x=><mesh key={x} position={[x,-.3,-2.52]}><sphereGeometry args={[.1,8,5]} /><meshBasicMaterial color="#ffde93" /></mesh>)}
    </> : [-.4,0,.4].map(x=><mesh key={x} position={[x,.65,0]}><octahedronGeometry args={[.4]} /><meshStandardMaterial color="#d7a86a" /></mesh>)}
    {[-.65,.65].flatMap(x=>[-(train ? 1.7 : .65),train ? 1.7 : .65].map(z=><mesh key={`${x}:${z}`} position={[x,-.6,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.24,.24,.18,8]} /><meshStandardMaterial color="#293b3e" /></mesh>))}
  </group>;
}
