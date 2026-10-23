import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { useTrack } from "../track/TrackContext";
import { pointAtTrackOffset } from "../track/trackPath";
import { surfaceOffsetHeight } from "../track/trackSurface";
import { surfaceTexture } from "../rendering/surfaceTextures";

/** Rooftops, refinery terraces and a harbor podium actually carry the road.
 * Their visible surface stays below the shared drivable mesh and leaves crossings
 * open; detailed architecture never becomes an untested collision surface.
 */
export function TaiwanPlatforms() {
  const track = useTrack();
  const geometry = useMemo(() => {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
    const range = track.id === "taipei" ? [.47, .66] : track.id === "jiufen" ? [.25, .375] : track.id === "kaohsiung" ? [.45, .59] : undefined;
    if (range) {
      const road = track.race.RACE_ROUTE_SAMPLES.filter((p, i) => i % 5 === 0 && p.raceProgress >= range[0] && p.raceProgress <= range[1]);
      for (let i = 0; i < road.length - 1; i++) {
        const a = road[i], b = road[i + 1];
        if ([a, b].some(p => [track.samples, ...track.branches.map(b => b.samples)].some(r => r.some(s => p.height - s.height > 2 && Math.hypot(s.position[0] - p.position[0], s.position[1] - p.position[1]) < 13)))) continue;
        const base = vertices.length / 3;
        for (const p of [a, b]) for (const down of [0, -6]) for (const side of [-1, 1]) {
          const [x, z] = pointAtTrackOffset(p, side * 9);
          const y = surfaceOffsetHeight(p, side * 9) - .18 + down;
          vertices.push(x, y, z); uv.push(x / 5, z / 5 + down / 5);
        }
        for (const face of [[0, 1, 4, 5], [2, 6, 3, 7], [0, 4, 2, 6], [1, 3, 5, 7], [0, 2, 1, 3], [4, 5, 6, 7]]) {
          indices.push(base + face[0], base + face[1], base + face[2], base + face[2], base + face[1], base + face[3]);
        }
      }
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3)); geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }, [track]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} receiveShadow castShadow>
    <meshStandardMaterial color={track.id === "jiufen" ? "#8c7965" : "#81928b"} map={surfaceTexture("concrete")} bumpMap={surfaceTexture("concrete")} bumpScale={.04} roughness={.85} />
  </mesh>;
}
