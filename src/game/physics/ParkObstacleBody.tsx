import { RigidBody, CuboidCollider, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import { ParkObstacleModel } from "../components/ParkGardener";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import { createParkObstacle, parkObstaclePose, parkObstacleYaw } from "../track/parkObstacle";
import { KART_CONFIG } from "../core/kart/kartConfig";

export function ParkObstacleBody() {
  const track = useTrack(), runtimeRef = useTrackRuntimeRef();
  const obstacle = useMemo(() => createParkObstacle(track.race.RACE_ROUTE_SAMPLES, track.id, track.branches.find(branch => branch.id === "taipei-crossing")?.samples), [track]);
  const body = useRef<RapierRigidBody>(null), seconds = useRef(0), pose = useRef({ x: 0, y: 0, z: 0 });
  useBeforePhysicsStep(() => {
    seconds.current += KART_CONFIG.fixedTimeStep;
    runtimeRef.current.seconds = seconds.current;
    parkObstaclePose(obstacle, seconds.current, pose.current);
    body.current?.setNextKinematicTranslation(pose.current);
    const yaw = parkObstacleYaw(obstacle, seconds.current);
    body.current?.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
  });
  const p = parkObstaclePose(obstacle, 0);
  return <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[p.x, p.y, p.z]} rotation={[0, obstacle.yaw, 0]}>
    <CuboidCollider args={[obstacle.dimensions.halfWidth, obstacle.dimensions.halfHeight, obstacle.dimensions.halfLength]} name="track-guard" friction={0} restitution={.12} />
    <ParkObstacleModel />
  </RigidBody>;
}
