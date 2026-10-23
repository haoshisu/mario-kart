import { useEffect, useMemo } from "react";
import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import { useTrack } from "../track/TrackContext";
import { createTaipeiWorld } from "../track/taipeiWorld";
import { useRenderQuality } from "../rendering/RenderSettings";
import { districtGroundGeometry, basinMountainGeometry, bridgeGeometry, riverStripGeometry, worldBuildingGeometry } from "../rendering/taipeiWorldGeometry";
import { surfaceTexture } from "../rendering/surfaceTextures";

function facadeTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot create city facade texture");
  context.fillStyle = "#d4d7cb"; context.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    context.fillStyle = (row * 7 + col * 3) % 5 === 0 ? "#ffe0a4" : "#4a6874";
    context.fillRect(col * 32 + 7, row * 32 + 7, 18, 18);
    context.fillStyle = "#9aa9a6"; context.fillRect(col * 32 + 7, row * 32 + 25, 20, 2);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
}
/** Outer world is visual only. Geometry is batched and receives no shadow pass;
 * atmospheric colors keep mountains readable beyond the driving surface fog.
 */
export function TaipeiWorld() {
  const track = useTrack(), quality = useRenderQuality();
  const world = useMemo(() => createTaipeiWorld(track), [track]);
  const facade = useMemo(() => facadeTexture(), []);
  const water = useMemo(() => { const texture = surfaceTexture("water").clone(); texture.repeat.set(4, 12); return texture; }, []);
  useEffect(() => () => water.dispose(), [water]);
  const geometry = useMemo(() => ({
    districts: districtGroundGeometry(track, world.buildings, quality === "low"),
    city: worldBuildingGeometry(world.buildings, quality === "low"), mountains: basinMountainGeometry(track),
    river: riverStripGeometry(track, -22, 22, -.12),
    westBank: riverStripGeometry(track, -30, -22, -.08), eastBank: riverStripGeometry(track, 22, 30, -.08),
    bridges: bridgeGeometry(track, world.bridges),
  }), [track, world, quality]);
  useEffect(() => () => { Object.values(geometry).forEach(g => g.dispose()); }, [geometry]);
  useEffect(() => () => facade.dispose(), [facade]);
  return <group name="taipei-basin-world">
    <mesh position={[world.center[0], -.55, world.center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2600, 2600]} /><meshBasicMaterial color="#687a73" fog={false} />
    </mesh>
    <mesh geometry={geometry.mountains}><meshBasicMaterial vertexColors side={DoubleSide} fog={false} /></mesh>
    <mesh geometry={geometry.districts}><meshBasicMaterial vertexColors fog={false} /></mesh>
    <mesh geometry={geometry.city}><meshStandardMaterial vertexColors map={facade} roughness={.88} fog={false} /></mesh>
    <mesh geometry={geometry.river}><meshStandardMaterial color="#527e8b" map={water} roughness={.3} metalness={.25} fog={false} /></mesh>
    {[geometry.westBank, geometry.eastBank].map((g, index) => <mesh key={index} geometry={g}><meshBasicMaterial color="#8e9a75" fog={false} /></mesh>)}
    <mesh geometry={geometry.bridges}><meshStandardMaterial vertexColors roughness={.85} fog={false} /></mesh>
  </group>;
}
