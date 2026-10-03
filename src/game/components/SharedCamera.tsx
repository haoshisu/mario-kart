import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { updateSharedCameraFrame } from "../core/motion/sharedCameraFraming";
import type { SnapshotBuffer } from "../network/interpolation";

type SharedCameraProps = { snapshotsRef: RefObject<SnapshotBuffer> };
const VIEW_DIRECTION = new Vector3(0.54, 0.85, 0.62).normalize();

export function SharedCamera({ snapshotsRef }: SharedCameraProps) {
  const frameRef = useRef({ x: 0, z: 0, distance: 0, initialized: false });
  const targetRef = useRef(new Vector3());

  useFrame(({ camera }, delta) => {
    const snapshot = snapshotsRef.current.sample();
    if (!(camera instanceof PerspectiveCamera)) return;
    if (!snapshot || snapshot.players.length === 0) {
      // Re-enter the course overview after leaving a race, including on phones.
      if (camera.fov !== 44 || camera.far !== 700) {
        camera.fov = 44;
        camera.far = 700;
        camera.updateProjectionMatrix();
      }
      targetRef.current.set(0, 0, 12);
      camera.position.copy(VIEW_DIRECTION).multiplyScalar(145 / Math.min(1, camera.aspect)).add(targetRef.current);
      camera.lookAt(targetRef.current);
      frameRef.current.initialized = false;
      return;
    }
    const frame = frameRef.current;
    if (!updateSharedCameraFrame(frame, snapshot.players, camera.getEffectiveFOV(), camera.aspect, delta)) return;
    targetRef.current.set(frame.x, snapshot.players.reduce((sum, player) => sum + player.position[1], 0) / snapshot.players.length + .4, frame.z);
    camera.position.copy(VIEW_DIRECTION).multiplyScalar(frame.distance).add(targetRef.current);
    if (camera.far < frame.distance * 2 + 50) {
      camera.far = frame.distance * 2 + 50;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(targetRef.current);
  });

  return null;
}
