import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from "three";
import { useTrack } from "../track/TrackContext";
import { taiwanSlopeVertices } from "../track/taiwanTerrainShape";
import type { TaiwanTrackId } from "../track/taiwanTracks";
import { surfaceTexture } from "../rendering/surfaceTextures";

/** The same connected soil surface supports the visible forest roots. */
export function TaiwanTerrain({ id }: { id: TaiwanTrackId }) {
  const track = useTrack();
  const geometry = useMemo(() => {
    const vertices = taiwanSlopeVertices(track), geometry = new BufferGeometry();
    const color = new Color(id === "jiufen" ? "#8b7d64" : "#6c7760"), colors: number[] = [], uvs: number[] = [];
    for (let i = 0; i < vertices.length; i += 3) {
      const shade = .88 + (i / 3 % 3) * .04;
      colors.push(color.r * shade, color.g * shade, color.b * shade); uvs.push(vertices[i] / 5, vertices[i + 1] / 5);
    }
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3)); geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)); geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals(); return geometry;
  }, [track, id]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} receiveShadow>
    <meshStandardMaterial vertexColors side={DoubleSide} map={surfaceTexture("concrete")} bumpMap={surfaceTexture("concrete")} bumpScale={.2} roughness={1} />
  </mesh>;
}
