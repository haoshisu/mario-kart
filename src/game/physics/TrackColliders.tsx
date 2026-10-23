import { RotatingBridgeBody } from "./RotatingBridgeBody";
import { ParkObstacleBody } from "./ParkObstacleBody";
import { useCallback } from "react";
import { CuboidCollider, RigidBody, TrimeshCollider, useRapier, type RapierCollider } from "@react-three/rapier";
import { useTrack } from "../track/TrackContext";

/** Static collision geometry. Every transform is shared with the visible track. */
export function TrackColliders() {
  const { rapier } = useRapier();
  const { ground, branches, bridge, geometry: { GUARD_RAIL_SEGMENTS, DRIVABLE_MESH_DATA } } = useTrack();
  const configureRoad = useCallback((collider: RapierCollider | null) => {
    collider?.setShape(new rapier.TriMesh(DRIVABLE_MESH_DATA.vertices, DRIVABLE_MESH_DATA.indices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES));
  }, [rapier, DRIVABLE_MESH_DATA]);
  return (
    <>
    <ParkObstacleBody /><RotatingBridgeBody />
    <RigidBody colliders={false} type="fixed">
      <CuboidCollider
        args={[
          ground.width / 2,
          ground.thickness / 2,
          ground.depth / 2,
        ]}
        friction={0}
        name="track-ground"
        position={[ground.centerX, -ground.thickness / 2, ground.centerZ]}
      />

      <TrimeshCollider
        ref={configureRoad}
        args={[DRIVABLE_MESH_DATA.vertices, DRIVABLE_MESH_DATA.indices]}
        friction={0}
        name="track-road"
      />


      {branches.filter(branch=>!branch.movable).map(branch => <TrimeshCollider key={branch.id} args={[branch.geometry.DRIVABLE_MESH_DATA.vertices, branch.geometry.DRIVABLE_MESH_DATA.indices]} friction={0} name="track-road" />)}
      {bridge && [bridge.geometries[0],bridge.geometries[2]].map((part,i)=><TrimeshCollider key={`bridge-stub-${i}`} args={[part.DRIVABLE_MESH_DATA.vertices,part.DRIVABLE_MESH_DATA.indices]} friction={0} name="track-road" />)}
      {[...GUARD_RAIL_SEGMENTS, ...branches.flatMap(branch => branch.movable && bridge ? [...bridge.geometries[0].GUARD_RAIL_SEGMENTS,...bridge.geometries[2].GUARD_RAIL_SEGMENTS] : branch.geometry.GUARD_RAIL_SEGMENTS)].map((segment, index) => (
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
    </>
  );
}
