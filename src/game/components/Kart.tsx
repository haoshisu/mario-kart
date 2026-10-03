import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Vector3, type Group } from "three";
import type { KartRuntimeState } from "../runtime/kartRuntime";
import { KART_CONFIG, KART_WHEEL_POSITIONS } from "../core/kart/kartConfig";
import { createKartPresentation, stepKartPresentation } from "../core/kart/kartPresentation";
import { DriftEffects } from "./DriftEffects";
import { KartBodyModel, KartWheelModel } from "../assets/KartModel";

type KartProps = {
  runtimeRef: RefObject<KartRuntimeState>;
};

export function Kart({ runtimeRef }: KartProps) {
  const presentationRef = useRef(createKartPresentation());
  const rootRef = useRef<Group>(null);
  const forwardRef = useRef(new Vector3());
  const visualRef = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    const visual = visualRef.current;
    const runtime = runtimeRef.current;

    if (!visual || !runtime) {
      return;
    }

    // Read Rapier's interpolated parent, not last frame's visual offset.
    const root = rootRef.current;
    if (root?.parent) {
      root.parent.getWorldPosition(runtime.renderPosition);
      const presentation = presentationRef.current;
      stepKartPresentation(presentation, runtime.renderPosition, delta, runtime.poseRevision);
      runtime.renderPosition.x = presentation.x.value;
      runtime.renderPosition.z = presentation.z.value;
      root.position.copy(runtime.renderPosition);
      root.parent.worldToLocal(root.position);
      // Publish the actual drawn pose for the camera in the same render frame.
      root.getWorldPosition(runtime.renderPosition);
      root.getWorldDirection(forwardRef.current);
      runtime.renderYaw = Math.atan2(forwardRef.current.x, forwardRef.current.z);
    }
    const speedWeight = Math.min(1, Math.abs(runtime.speed) / KART_CONFIG.steeringFullSpeed);
    const targetLean = runtime.steer * speedWeight *
      (runtime.drifting ? -KART_CONFIG.visual.driftLean : -KART_CONFIG.visual.normalLean);
    const smoothing = 1 - Math.exp(-10 * Math.min(delta, 0.1));
    visual.rotation.z += (targetLean - visual.rotation.z) * smoothing;
    visual.rotation.x = Math.sin(clock.elapsedTime * 42) * runtime.collisionShake * 0.045;
    visual.position.y = Math.sin(clock.elapsedTime * 50) * runtime.collisionShake * 0.025;
  }, -1);

  return (
    <group ref={rootRef}>
      <group scale={KART_CONFIG.modelScale} position={[0, -0.43 * (1 - KART_CONFIG.modelScale), 0]}>
      <group ref={visualRef}>
        <KartBodyModel color="#f2b52e" motionRef={runtimeRef} />
      </group>
      {KART_WHEEL_POSITIONS.map((position, index) => <KartWheelModel key={index} position={position} motionRef={runtimeRef} />)}

      <DriftEffects runtimeRef={runtimeRef} />
      </group>
    </group>
  );
}
