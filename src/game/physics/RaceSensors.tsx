import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { RACE_MARKERS } from "../core/race/raceTrack";

/**
 * Rapier sensor volumes mirror the pure swept-segment checkpoint zones. The
 * race core remains authoritative so a fast kart cannot tunnel past a gate.
 */
export function RaceSensors() {
  return (
    <RigidBody colliders={false} type="fixed">
      {RACE_MARKERS.map((marker) => (
        <CuboidCollider
          args={[marker.halfWidth, 0.75, marker.halfDepth]}
          key={marker.id}
          name={`race-sensor-${marker.id}`}
          position={[marker.position[0], 0.75, marker.position[1]]}
          rotation={[0, marker.respawn.yaw, 0]}
          sensor
        />
      ))}
    </RigidBody>
  );
}
