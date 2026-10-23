import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { useTrack } from "../track/TrackContext";
import { taiwanSoilHeight } from "../track/taiwanTerrainShape";
import type { ArchitecturePlacement } from "../track/taiwanArchitecture";
import { surfaceTexture } from "../rendering/surfaceTextures";

/** Small soil shoulders carry the spreading roots onto the sloped forest floor. */
export function TaiwanRootSoil({ placements }: { placements: readonly ArchitecturePlacement[] }) {
  const track = useTrack();
  const geometry = useMemo(() => {
    const vertices: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
    const soil = new Color("#6f6852"), moss = new Color("#62735a"), count = 12;
    for (const tree of placements.filter(p => p.module === "cedar")) {
      const [x, y, z] = tree.position, inner = Math.min(3.4 * tree.scale[0], tree.radius - .25), outer = Math.min(tree.radius, inner + 2), base = vertices.length / 3;
      vertices.push(x, y + .04, z); colors.push(soil.r, soil.g, soil.b); uv.push(x / 3, z / 3);
      for (const radius of [inner, outer]) for (let i = 0; i < count; i++) {
        const px = x + Math.cos(i * Math.PI * 2 / count) * radius, pz = z + Math.sin(i * Math.PI * 2 / count) * radius;
        vertices.push(px, radius === inner ? y + .04 : taiwanSoilHeight(track, px, pz) + .015, pz);
        const color = radius === inner ? soil : moss; colors.push(color.r, color.g, color.b); uv.push(px / 3, pz / 3);
      }
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count, a = base + 1 + i, b = base + 1 + next;
        indices.push(base, b, a, a, b, a + count, b, b + count, a + count);
      }
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3)); geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }, [track, placements]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial vertexColors map={surfaceTexture("concrete")} roughness={1} /></mesh>;
}
