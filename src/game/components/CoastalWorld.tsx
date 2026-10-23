import { surfaceTexture } from "../rendering/surfaceTextures";
import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { useTrack } from "../track/TrackContext";
import { COASTAL_WORLD, type CoastalCity } from "../track/coastalWorld";
import { useRenderQuality } from "../rendering/RenderSettings";
import { coastalBuildingsGeometry, coastalHorizonGeometry, coastalLandGeometry, coastalLandmarksGeometry } from "../rendering/coastalWorldGeometry";

/** Distant scenery shares batched geometry; it never participates in race physics. */
export function CoastalWorld({ id }: { id: CoastalCity }) {
  const track = useTrack(), quality = useRenderQuality();
  const geometry = useMemo(() => ({
    buildings: coastalBuildingsGeometry(track, id, quality === "low"), land: coastalLandGeometry(track, id),
    landmarks: coastalLandmarksGeometry(track, id, quality === "low"), horizon: coastalHorizonGeometry(track, id),
  }), [track, id, quality]);
  useEffect(() => () => Object.values(geometry).forEach(g => g.dispose()), [geometry]);
  return <group name={`${id}-coastal-world`}>
    <mesh renderOrder={-900} rotation={[-Math.PI / 2, 0, 0]} position={[track.bounds.centerX, -.4, track.bounds.centerZ]}>
      <planeGeometry args={[COASTAL_WORLD.seaSize, COASTAL_WORLD.seaSize]} />
      <meshStandardMaterial color={id === "jiufen" ? "#548b98" : "#648d98"} roughness={.62} metalness={.05} bumpMap={surfaceTexture("water")} bumpScale={.06} fog={false} depthWrite={false} />
    </mesh>
    <mesh geometry={geometry.land}>{id === "kaohsiung" ? <meshBasicMaterial vertexColors fog={false} /> : <meshStandardMaterial vertexColors side={DoubleSide} roughness={1} fog={false} />}</mesh>
    <mesh geometry={geometry.buildings}><meshStandardMaterial vertexColors roughness={.85} fog={false} /></mesh>
    <mesh geometry={geometry.landmarks}><meshStandardMaterial vertexColors roughness={.8} fog={false} /></mesh>
    <mesh geometry={geometry.horizon}><meshBasicMaterial vertexColors fog={false} /></mesh>
  </group>;
}
