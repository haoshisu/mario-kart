import { CHECKPOINTS } from "../core/race/raceTrack";
import { TRACK_CONFIG } from "../track/trackConfig";

const CHECKPOINT_COLORS = ["#46dcff", "#b58cff", "#d7ff38"] as const;

export function RaceMarkers() {
  return (
    <group>
      {CHECKPOINTS.map((marker, index) => {
        const color = CHECKPOINT_COLORS[index];
        const left = [
          marker.position[0] - marker.right[0] * marker.halfWidth,
          marker.position[1] - marker.right[1] * marker.halfWidth,
        ] as const;
        const right = [
          marker.position[0] + marker.right[0] * marker.halfWidth,
          marker.position[1] + marker.right[1] * marker.halfWidth,
        ] as const;

        return (
          <group key={marker.id}>
            <mesh
              position={[
                marker.position[0],
                TRACK_CONFIG.roadTop + 0.025,
                marker.position[1],
              ]}
              rotation={[0, marker.respawn.yaw, 0]}
              receiveShadow
            >
              <boxGeometry args={[marker.halfWidth * 2, 0.025, 0.24]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} />
            </mesh>
            {[left, right].map(([x, z], postIndex) => (
              <mesh castShadow key={postIndex} position={[x, 1.15, z]}>
                <cylinderGeometry args={[0.08, 0.1, 2.3, 6]} />
                <meshStandardMaterial color={color} metalness={0.2} roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
