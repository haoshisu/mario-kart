import { useCallback } from "react";
import { CuboidCollider, RigidBody, TrimeshCollider, useRapier, type RapierCollider } from "@react-three/rapier";
import { useTrack } from "../track/TrackContext";
import { TRACK_CONFIG } from "../track/trackConfig";

/** Static collision geometry. Every transform is shared with the visible track. */
export function TrackColliders() {
  const { rapier } = useRapier();
  const { geometry: { GUARD_RAIL_SEGMENTS, DRIVABLE_MESH_DATA } } = useTrack();
  const configureRoad = useCallback((collider: RapierCollider | null) => {
    collider?.setShape(new rapier.TriMesh(DRIVABLE_MESH_DATA.vertices, DRIVABLE_MESH_DATA.indices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES));
  }, [rapier, DRIVABLE_MESH_DATA]);
  return (
    <RigidBody colliders={false} type="fixed">
      <CuboidCollider
        args={[
          TRACK_CONFIG.ground.width / 2,
          TRACK_CONFIG.ground.thickness / 2,
          TRACK_CONFIG.ground.depth / 2,
        ]}
        friction={0}
        name="track-ground"
        position={[0, -TRACK_CONFIG.ground.thickness / 2, 0]}
      />

      <TrimeshCollider
        ref={configureRoad}
        args={[DRIVABLE_MESH_DATA.vertices, DRIVABLE_MESH_DATA.indices]}
        friction={0}
        name="track-road"
      />


      {GUARD_RAIL_SEGMENTS.map((segment, index) => (
        <CuboidCollider
          key={index}
          args={[segment.size[0] / 2, segment.size[1] / 2, segment.size[2] / 2]}
          friction={0}
          name="track-guard"
          position={segment.position}
          restitution={0.12}
          rotation={[0, segment.rotationY, segment.rotationZ]}
        />
      ))}
    </RigidBody>
  );
}
