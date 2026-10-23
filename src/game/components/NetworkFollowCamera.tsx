import { constrainRoadCamera, createRoadCameraState, frameRoadCamera } from "../core/camera/roadCamera";
import { useTrack } from "../track/TrackContext";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { createChaseCamera, stepChaseCamera } from "../core/camera/chaseCamera";
import type { SnapshotBuffer } from "../network/interpolation";

export function NetworkFollowCamera({ playerId, snapshotsRef }: {
  playerId: string;
  snapshotsRef: RefObject<SnapshotBuffer>;
}) {
  const track = useTrack();
  const roadCamera = useRef(createRoadCameraState());
  const stateRef = useRef(createChaseCamera());
  useFrame(({ camera, size, clock }, delta) => {
    const snapshot = snapshotsRef.current.sampleFrame(clock.elapsedTime);
    const player = snapshot?.players.find((entry) => entry.id === playerId);
    if (!snapshot || !player) return;
    const state = stateRef.current;
    stepChaseCamera(state, player, snapshot.phase, delta);
    if ("fov" in camera) {
      const fov = 2 * Math.atan(Math.tan(state.fov * Math.PI / 360) / Math.min(1, size.width / size.height)) * 180 / Math.PI;
      if (Math.abs(Number(camera.fov) - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    constrainRoadCamera(state.position, state.target, state.kartPosition, track, roadCamera.current, delta, state.revision);
    if ("fov" in camera) frameRoadCamera(state.position, state.target, state.kartPosition, Number(camera.fov), roadCamera.current, delta);
    camera.position.set(state.position.x, state.position.y, state.position.z);
    camera.lookAt(state.target.x, state.target.y, state.target.z);
  });
  return null;
}
