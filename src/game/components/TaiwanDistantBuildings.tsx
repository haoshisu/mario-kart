import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Object3D, PlaneGeometry, type InstancedMesh } from "three";
import { useTrack } from "../track/TrackContext";
import { sceneryDetailDistance, TAIWAN_SCENERY_LOD } from "../rendering/sceneAtmosphere";
import { useRenderQuality } from "../rendering/RenderSettings";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ArchitecturePlacement } from "../track/taiwanArchitecture";

/** Distant silhouettes preserve street density and forest canopy at low cost. */
export function TaiwanDistantBuildings({ placements }: { placements: readonly ArchitecturePlacement[] }) {
  const refs = useRef<Array<InstancedMesh | null>>([]), quality = useRenderQuality();
  const track = useTrack();
  const scratch = useMemo(() => new Object3D(), []);
  const buildingGeometry = useMemo(() => {
    const tint = (geometry: BoxGeometry | PlaneGeometry, color: readonly [number, number, number]) => {
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set(color, i);
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      return geometry;
    };
    const parts = [tint(new BoxGeometry(), [1, 1, 1]), tint(new BoxGeometry(1.06, .06, 1.04).translate(0, .52, 0), [.28, .32, .31])];
    for (const side of [-1, 1]) for (const x of [-.26, .26]) for (const y of [.06, .31]) {
      const window = new PlaneGeometry(.19, .16).rotateY(side > 0 ? 0 : Math.PI).translate(x, y, side * .501);
      parts.push(tint(window, y < .1 ? [.88, .72, .43] : [.22, .35, .39]));
    }
    const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose()); return geometry;
  }, []);
  useEffect(() => () => buildingGeometry.dispose(), [buildingGeometry]);
  const treeGeometry = useMemo(() => {
    const trunk = new CylinderGeometry(.35, .85, 11, 6).translate(0, 5.5, 0);
    const crowns = [0, 1, 2].map(i => new ConeGeometry(4 - i * .8, 7, 8).translate(0, 9 + i * 3, 0));
    for (const [i, part] of [trunk, ...crowns].entries()) {
      const color = new Color(i ? "#406453" : "#67513b");
      const colors = new Float32Array(part.attributes.position.count * 3);
      for (let vertex = 0; vertex < part.attributes.position.count; vertex++) color.toArray(colors, vertex * 3);
      part.setAttribute("color", new Float32BufferAttribute(colors, 3));
    }
    const geometry = mergeGeometries([trunk, ...crowns]);
    trunk.dispose(); crowns.forEach(g => g.dispose());
    return geometry;
  }, []);
  useEffect(() => () => treeGeometry.dispose(), [treeGeometry]);
  const groups = useMemo(() => [
    placements.filter(p => ["arcade", "stucco", "tea", "warehouse", "station"].includes(p.module) && !p.portal),
    placements.filter(p => p.module === "cedar" && p.scale[1] < 2),
  ].map(placements => placements.map(p => ({ ...p, tint: new Color(p.module === "cedar" ? "#ffffff" : p.module === "arcade" ? "#9d6650" : p.module === "stucco" ? "#a49a82" : "#645446") }))), [placements]);
  useFrame(({ camera }) => {
    const range = sceneryDetailDistance(track.id, quality);
    groups.forEach((group, index) => {
      const mesh = refs.current[index];
      if (!mesh) return;
      let count = 0;
      for (const p of group) {
        if (camera.position.y <= TAIWAN_SCENERY_LOD.overviewHeight && Math.hypot(camera.position.x - p.position[0], camera.position.z - p.position[2]) <= range) continue;
        scratch.position.set(p.position[0], p.position[1] + (index ? 0 : 5), p.position[2]);
        scratch.rotation.set(0, p.yaw, 0);
        scratch.scale.set(index ? p.scale[0] : 8.8, index ? p.scale[1] : 10, index ? p.scale[2] : 7.8); scratch.updateMatrix();
        mesh.setMatrixAt(count, scratch.matrix); mesh.setColorAt(count++, p.tint);
      }
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  });
  return <group>{groups.map((group, index) => <instancedMesh key={index} ref={mesh => { refs.current[index] = mesh; }} args={[undefined, undefined, Math.max(1, group.length)]} frustumCulled={false}>
    {index ? <primitive object={treeGeometry} attach="geometry" /> : <primitive object={buildingGeometry} attach="geometry" />}<meshStandardMaterial vertexColors roughness={.95} />
  </instancedMesh>)}</group>;
}
