import { TRACK_COLORS, TRACK_CONFIG } from "../track/trackConfig";

export function Ground() {
  return (
    <mesh position={[0, -TRACK_CONFIG.ground.thickness / 2, 0]} receiveShadow>
      <boxGeometry
        args={[
          TRACK_CONFIG.ground.width,
          TRACK_CONFIG.ground.thickness,
          TRACK_CONFIG.ground.depth,
        ]}
      />
      <meshStandardMaterial color={TRACK_COLORS.grass} roughness={0.98} />
    </mesh>
  );
}
