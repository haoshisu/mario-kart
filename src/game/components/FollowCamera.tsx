import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { createChaseCamera, stepChaseCamera } from "../core/camera/chaseCamera";
import { constrainRoadCamera, createRoadCameraState, frameRoadCamera } from "../core/camera/roadCamera";
import type { KartRuntimeState } from "../runtime/kartRuntime";
import { useTrack } from "../track/TrackContext";

export function FollowCamera({ runtimeRef }: { runtimeRef: RefObject<KartRuntimeState> }) {
  const track = useTrack();
  const stateRef = useRef(createChaseCamera());
  const roadCamera = useRef(createRoadCameraState());
  const revision = useRef(-1);
  useFrame(({ camera, size }, delta) => {
    const runtime = runtimeRef.current;
    const state = stateRef.current;
    if (revision.current !== runtime.poseRevision) {
      state.motion.initialized = false;
      revision.current = runtime.poseRevision;
    }
    stepChaseCamera(state, {
      position: [runtime.renderPosition.x, runtime.renderPosition.y, runtime.renderPosition.z],
      yaw: runtime.renderYaw, speed: runtime.speed, spinOutRemaining: 0,
    }, "racing", delta);
    constrainRoadCamera(state.position, state.target, state.kartPosition, track, roadCamera.current, delta, state.revision);
    if ("fov" in camera) {
      const fov = 2 * Math.atan(Math.tan(state.fov * Math.PI / 360) / Math.min(1, size.width / size.height)) * 180 / Math.PI;
      if (Math.abs(Number(camera.fov) - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      frameRoadCamera(state.position, state.target, state.kartPosition, fov, roadCamera.current, delta);
    }
    camera.position.set(state.position.x, state.position.y, state.position.z);
    camera.lookAt(state.target.x, state.target.y, state.target.z);
  });
  return null;
}
