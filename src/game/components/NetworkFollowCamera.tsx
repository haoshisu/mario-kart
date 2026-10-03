import { useTrack } from "../track/TrackContext";
import { createSurfaceResult, sampleTrackSurface } from "../track/trackSurface";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { createChaseCamera, stepChaseCamera } from "../core/camera/chaseCamera";
import type { SnapshotBuffer } from "../network/interpolation";

export function NetworkFollowCamera({ playerId, snapshotsRef }: {
  playerId: string;
  snapshotsRef: RefObject<SnapshotBuffer>;
}) {
  const track = useTrack();
  const surface = useRef(createSurfaceResult());
  const stateRef = useRef(createChaseCamera());
  useFrame(({ camera, size }, delta) => {
    if ("fov" in camera) {
      // Preserve horizontal visibility on narrow phones instead of cropping the kart.
      const fov = 2 * Math.atan(Math.tan(22 * Math.PI / 180) / Math.min(1, size.width / size.height)) * 180 / Math.PI;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    const snapshot = snapshotsRef.current.sample();
    const player = snapshot?.players.find((entry) => entry.id === playerId);
    if (!snapshot || !player) return;
    const state = stateRef.current;
    stepChaseCamera(state, player, snapshot.phase, delta);
    sampleTrackSurface(state.position.x, state.position.z, track.samples, surface.current);
    if (surface.current.distance < 7) state.position.y = Math.max(state.position.y, surface.current.height + 2.2);
    sampleTrackSurface(state.target.x, state.target.z, track.samples, surface.current);
    state.target.y = surface.current.height + 1.1;
    camera.position.set(state.position.x, state.position.y, state.position.z);
    camera.lookAt(state.target.x, state.target.y, state.target.z);
  });
  return null;
}
