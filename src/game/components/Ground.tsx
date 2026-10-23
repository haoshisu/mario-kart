import { surfaceTexture } from "../rendering/surfaceTextures";
import { useTrack } from "../track/TrackContext";

export function Ground() {
  const { id, colors: TRACK_COLORS, ground } = useTrack();
  // The harbor water already covers this footprint; an invisible slab directly
  // underneath it causes depth flicker when the world camera zooms out.
  if (id === "jiufen" || id === "kaohsiung" || id === "tainan" || id === "taichung") return null;
  const width = ground.width;
  const centerX = ground.centerX;
  return (
    <mesh position={[centerX, -ground.thickness / 2, ground.centerZ]} receiveShadow>
      <boxGeometry
        args={[
          width,
          ground.thickness,
          ground.depth,
        ]}
      />
      <meshStandardMaterial color={id === "taipei" ? "#6c6861" : TRACK_COLORS.grass} map={surfaceTexture(id === "taipei" ? "concrete" : "grass")} bumpMap={surfaceTexture(id === "taipei" ? "concrete" : "grass")} bumpScale={.04} roughness={0.98} />
    </mesh>
  );
}
