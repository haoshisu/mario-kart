import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Mesh, MeshStandardMaterial, Object3D, type InstancedMesh } from "three";
import { useRenderQuality } from "../rendering/RenderSettings";
import { useTrack } from "../track/TrackContext";
import { sceneryDetailDistance, TAIWAN_SCENERY_LOD } from "../rendering/sceneAtmosphere";
import { surfaceTexture, type SurfaceKind } from "../rendering/surfaceTextures";
import type { ArchitecturePlacement, TaiwanModule } from "../track/taiwanArchitecture";

const URL = "/models/taiwan-environment-v1.glb";
const LOW_URL = "/models/taiwan-environment-low-v1.glb";
const surface: Partial<Record<string, SurfaceKind>> = { Masonry: "brick", Stone: "concrete", Timber: "wood", Roof: "metal", Metal: "metal" };
/** Original Blender modules retain recessed rooms and genuinely open vaults.
 * Compact instance buffers bound facade cost by camera distance, not map size.
 */
export function TaiwanArchitecture({ placements }: { placements: readonly ArchitecturePlacement[] }) {
  const quality = useRenderQuality(), { scene } = useGLTF(quality === "low" ? LOW_URL : URL);
  const refs = useRef<Array<InstancedMesh | null>>([]);
  const track = useTrack();
  const scratch = useMemo(() => new Object3D(), []);
  const resources = useMemo(() => {
    const masonryMap = surfaceTexture("brick").clone();
    masonryMap.repeat.set(3, 6);
    scene.updateMatrixWorld(true);
    const result: Array<{ geometry: Mesh["geometry"]; material: MeshStandardMaterial; placements: readonly ArchitecturePlacement[]; module: TaiwanModule; landmark: boolean }> = [];
    scene.traverse(object => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      const module = placements.find(p => p.module === object.name.split("_")[0])?.module;
      if (!module) return;
      const instances = placements.filter(p => p.module === module);
      if (!instances.length) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      const material = object.material.clone(), kind = surface[material.name];
      if (kind) { material.map = material.name === "Masonry" ? masonryMap : surfaceTexture(kind); material.bumpMap = material.map; material.bumpScale = kind === "brick" ? .035 : .018; }
      if (material.name === "Glow") { material.emissive.set("#ffad54"); material.emissiveIntensity = .9; material.toneMapped = false; }
      result.push({ geometry, material, placements: instances, module, landmark: ["tower", "ocean", "crane"].includes(module) });
    });
    return { parts: result, masonryMap };
  }, [scene, placements]);
  const parts = resources.parts;
  useEffect(() => () => { parts.forEach(p => { p.geometry.dispose(); p.material.dispose(); }); resources.masonryMap.dispose(); }, [parts, resources]);
  useFrame(({ camera }) => {
    const overview = camera.position.y > TAIWAN_SCENERY_LOD.overviewHeight, range = sceneryDetailDistance(track.id, quality);
    parts.forEach((part, index) => {
      const mesh = refs.current[index];
      if (!mesh) return;
      let count = 0;
      for (const p of part.placements) {
        const [x, y, z] = p.position;
        const landmark = part.landmark || p.portal || p.scale[1] > 2 || p.radius >= 14;
        if (!landmark && (overview || Math.hypot(camera.position.x - x, camera.position.z - z) > range)) continue;
        scratch.position.set(x, y, z); scratch.rotation.set(0, p.yaw, 0); scratch.scale.set(...p.scale); scratch.updateMatrix();
        mesh.setMatrixAt(count++, scratch.matrix);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
  return <group name="taiwan-blender-architecture" dispose={null}>{parts.map((part, index) => <instancedMesh key={`${part.module}-${part.material.name}`} ref={mesh => { refs.current[index] = mesh; }}
    args={[part.geometry, part.material, part.placements.length]} frustumCulled={false} castShadow={quality === "standard" && part.material.name !== "Glow" && part.material.name !== "Glass"} receiveShadow />)}</group>;
}
