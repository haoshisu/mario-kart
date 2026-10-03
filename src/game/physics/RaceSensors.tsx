import { useTrack } from "../track/TrackContext";
import { CuboidCollider, RigidBody } from "@react-three/rapier";

/**
 * Rapier sensor volumes mirror the pure swept-segment checkpoint zones. The
 * race core remains authoritative so a fast kart cannot tunnel past a gate.
 */
export function RaceSensors() {
  const { race: { RACE_MARKERS } } = useTrack();
  return (
    <RigidBody colliders={false} type="fixed">
      {RACE_MARKERS.map((marker) => (
        <CuboidCollider
          args={[marker.halfWidth, 0.75, marker.halfDepth]}
          key={marker.id}
          name={`race-sensor-${marker.id}`}
          position={[marker.position[0], marker.respawn.position[1] + .23, marker.position[1]]}
          rotation={[0, marker.respawn.yaw, 0]}
          sensor
        />
      ))}
    </RigidBody>
  );
}
