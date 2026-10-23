import { useEffect, useMemo } from "react";
import { useTrack } from "../track/TrackContext";
import { useRenderQuality } from "../rendering/RenderSettings";
import { tainanWorldGeometry } from "../rendering/tainanWorldGeometry";
import { TaiwanSky } from "./TaiwanSky";
import { TracksideResidents } from "./TracksideResidents";

export function TainanWorld() {
  const track=useTrack(),quality=useRenderQuality();
  const geometry=useMemo(()=>tainanWorldGeometry(track,quality==="low"),[track,quality]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group name="tainan-continuous-old-city">
    <TaiwanSky />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2.5,100]} renderOrder={-900}>
      <planeGeometry args={[10000,10000]} /><meshStandardMaterial color="#548f87" roughness={.55} fog={false} depthWrite={false} />
    </mesh>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={.9} /></mesh>
    <TracksideResidents />
  </group>;
}
