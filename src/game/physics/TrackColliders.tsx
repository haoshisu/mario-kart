import { CuboidCollider, RigidBody, TrimeshCollider } from "@react-three/rapier";
import {
  CURB_COLLIDER_MESH_DATA,
  GUARD_RAIL_SEGMENTS,
  ROAD_MESH_DATA,
} from "../track/trackGeometry";
import { TRACK_CONFIG } from "../track/trackConfig";

/** Static collision geometry. Every transform is shared with the visible track. */
export function TrackColliders() {
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
        args={[ROAD_MESH_DATA.vertices, ROAD_MESH_DATA.indices]}
        friction={0}
        name="track-road"
      />
      <TrimeshCollider
        args={[CURB_COLLIDER_MESH_DATA.vertices, CURB_COLLIDER_MESH_DATA.indices]}
        friction={0}
        name="track-curb"
      />

      {GUARD_RAIL_SEGMENTS.map((segment, index) => (
        <CuboidCollider
          key={index}
          args={[segment.size[0] / 2, segment.size[1] / 2, segment.size[2] / 2]}
          friction={0}
          name="track-guard"
          position={segment.position}
          restitution={0.12}
          rotation={[0, segment.rotationY, 0]}
        />
      ))}
    </RigidBody>
  );
}
