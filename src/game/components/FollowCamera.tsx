import { useTrack } from "../track/TrackContext";
import { createSurfaceResult, sampleTrackSurface } from "../track/trackSurface";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Vector3 } from "three";
import { KART_CONFIG } from "../core/kart/kartConfig";
import { getKartForward } from "../core/kart/kartPhysics";
import { createCameraMotion, stepCameraMotion } from "../core/camera/cameraMotion";
import type { KartRuntimeState } from "../runtime/kartRuntime";

type FollowCameraProps = {
  runtimeRef: RefObject<KartRuntimeState>;
};

export function FollowCamera({ runtimeRef }: FollowCameraProps) {
  const track = useTrack();
  const surface = useRef(createSurfaceResult());
  const camera = useThree((state) => state.camera);
  const desiredPosition = useRef(new Vector3());
  const desiredTarget = useRef(new Vector3());
  const motionRef = useRef(createCameraMotion());

  useFrame(({ clock }, frameDelta) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const motion = motionRef.current;
    stepCameraMotion(motion, runtime.renderPosition, runtime.renderYaw, frameDelta, runtime.poseRevision);
    const forward = getKartForward(motion.yaw.value);
    const shake = runtime.collisionShake;
    const shakeX = Math.sin(clock.elapsedTime * 43) * shake * 0.12;
    const shakeY = Math.sin(clock.elapsedTime * 57) * shake * 0.07;

    desiredPosition.current.set(
      motion.x.value - forward.x * KART_CONFIG.camera.distance + shakeX,
      Math.max(
        KART_CONFIG.camera.minimumHeight,
        motion.y.value + KART_CONFIG.camera.height + shakeY,
      ),
      motion.z.value - forward.z * KART_CONFIG.camera.distance,
    );
    desiredTarget.current.set(
      motion.x.value + forward.x * KART_CONFIG.camera.lookAhead,
      motion.y.value + 0.55,
      motion.z.value + forward.z * KART_CONFIG.camera.lookAhead,
    );

    // Use the kart's shared presentation position, without a second horizontal
    // spring that would change the following distance as speed fluctuates.
    sampleTrackSurface(desiredTarget.current.x, desiredTarget.current.z, track.samples, surface.current);
    desiredTarget.current.y = surface.current.height + 1.1;
    camera.position.copy(desiredPosition.current);
    camera.lookAt(desiredTarget.current);
  });

  return null;
}
