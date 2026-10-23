import { sceneCameraFar } from "../rendering/sceneAtmosphere";
import { useTrack } from "../track/TrackContext";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { updateSharedCameraFrame } from "../core/motion/sharedCameraFraming";
import type { SnapshotBuffer } from "../network/interpolation";

type SharedCameraProps = { snapshotsRef: RefObject<SnapshotBuffer> };
const VIEW_DIRECTION = new Vector3(0.54, 0.85, 0.62).normalize();

export function SharedCamera({ snapshotsRef }: SharedCameraProps) {
  const track = useTrack();
  const { centerX, centerZ, width, depth } = track.bounds;
  const maximumHeight = Math.max(...track.samples.map(sample => sample.height));
  const overviewRadius = Math.hypot(width + 16, depth + 16, maximumHeight + 10) / 2;
  const frameRef = useRef({ x: 0, z: 0, distance: 0, initialized: false });
  const targetRef = useRef(new Vector3());

  useFrame(({ camera, clock }, delta) => {
    const snapshot = snapshotsRef.current.sampleFrame(clock.elapsedTime);
    if (!(camera instanceof PerspectiveCamera)) return;
    if (!snapshot || snapshot.players.length === 0) {
      // Re-enter the course overview after leaving a race, including on phones.
      // Fit a sphere around the entire road, including perspective foreshortening.
      const halfFov = Math.atan(Math.tan(44 * Math.PI / 360) * Math.min(1, camera.aspect));
      const distance = Math.max(145, overviewRadius / Math.sin(halfFov));
      const far = Math.max(sceneCameraFar(track.id), 700, distance + overviewRadius + 30);
      if (camera.fov !== 44 || camera.far !== far) {
        camera.fov = 44;
        camera.far = far;
        camera.updateProjectionMatrix();
      }
      targetRef.current.set(centerX, maximumHeight / 2, centerZ);
      camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance).add(targetRef.current);
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
