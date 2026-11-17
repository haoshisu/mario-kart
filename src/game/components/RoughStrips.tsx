import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { useTrack } from "../track/TrackContext";
import { ROUGH_CONFIG } from "../track/roughZones";
import { TRACK_CONFIG } from "../track/trackConfig";
import { surfaceTexture } from "../rendering/surfaceTextures";

/** Grass apex strips drawn from the same zones the physics reads. */
export function RoughStrips() {
  const track = useTrack();
  const geometry = useMemo(() => {
    const vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
    for (const zone of track.roughZones) {
      const points = track.samples.filter(sample => {
        const progress = sample.courseProgress ?? sample.progress;
        return progress >= zone.from && progress <= zone.to;
      });
      points.forEach((sample, index) => {
        const edge = (sample.width ?? TRACK_CONFIG.roadWidth) / 2;
        const nx = -sample.tangent[1], nz = sample.tangent[0];
        const base = vertices.length / 3;
        for (const lateral of [zone.side * (edge - ROUGH_CONFIG.stripWidth), zone.side * edge]) {
          // Match the road's banked height so the strip never floats or sinks.
          vertices.push(sample.position[0] + nx * lateral, sample.height + lateral * Math.tan(sample.bank) + .025, sample.position[1] + nz * lateral);
          uvs.push(lateral / 2, index / 2);
        }
        if (index > 0) indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
      });
    }
    const mesh = new BufferGeometry();
    mesh.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    mesh.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    mesh.setIndex(indices);
    mesh.computeVertexNormals();
    return mesh;
  }, [track]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (track.roughZones.length === 0) return null;
  return <mesh geometry={geometry} receiveShadow name="rough-apex-strips">
    <meshStandardMaterial color="#6f9d3f" map={surfaceTexture("grass")} roughness={1} side={2}
      polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
  </mesh>;
}
