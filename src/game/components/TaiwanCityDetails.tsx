import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Mesh, MeshStandardMaterial, Object3D, type InstancedMesh } from "three";
import { useRenderQuality } from "../rendering/RenderSettings";
import { TAIWAN_SCENERY_LOD } from "../rendering/sceneAtmosphere";
import type { ArchitecturePlacement } from "../track/taiwanArchitecture";
import { CITY_DETAIL_DISTANCE, CITY_MODEL_URL, cityDetailPlacements } from "../track/taiwanCity";

/** Shared Blender meshes use vertex colors: a whole street's signs, balconies,
 * storefronts and rooftop tanks cost two draws per module, without point lights.
 */
export function TaiwanCityDetails({ buildings }: { buildings: readonly ArchitecturePlacement[] }) {
  const quality = useRenderQuality();
  const { scene } = useGLTF(CITY_MODEL_URL[quality]);
  const refs = useRef<Array<InstancedMesh | null>>([]);
  const scratch = useMemo(() => new Object3D(), []);
  const parts = useMemo(() => {
    const placements = cityDetailPlacements(buildings);
    scene.updateMatrixWorld(true);
    const result: Array<{ name: string; geometry: Mesh["geometry"]; material: MeshStandardMaterial; placements: typeof placements }> = [];
    scene.traverse(object => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      const instances = placements.filter(p => object.name.startsWith(`${p.module}_`));
      if (!instances.length) return;
      const material = object.material.clone();
      if (material.name === "CityLight") { material.emissive.set("#d66e32"); material.emissiveIntensity = .35; material.toneMapped = false; }
      result.push({ name: object.name, geometry: object.geometry.clone().applyMatrix4(object.matrixWorld), material, placements: instances });
    });
    return result;
  }, [scene, buildings]);
  useEffect(() => () => parts.forEach(part => { part.geometry.dispose(); part.material.dispose(); }), [parts]);
  useFrame(({ camera }) => {
    const overview = camera.position.y > TAIWAN_SCENERY_LOD.overviewHeight;
    const range = CITY_DETAIL_DISTANCE[quality];
    for (let i = 0; i < parts.length; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      let count = 0;
      if (!overview) for (const p of parts[i].placements) {
        if (Math.hypot(camera.position.x - p.position[0], camera.position.z - p.position[2]) > range) continue;
        scratch.position.set(...p.position); scratch.rotation.set(0, p.yaw, 0); scratch.scale.set(...p.scale); scratch.updateMatrix();
        mesh.setMatrixAt(count++, scratch.matrix);
      }
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
    }
  });
  return <group name="taiwan-city-street-details" dispose={null}>{parts.map((part, index) => <instancedMesh key={part.name}
    ref={mesh => { refs.current[index] = mesh; }} args={[part.geometry, part.material, part.placements.length]}
    frustumCulled={false} receiveShadow />)}</group>;
}
