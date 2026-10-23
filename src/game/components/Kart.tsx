import type { CharacterId } from "../entities/characters";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Euler, Quaternion, Vector3, type Group } from "three";
import type { KartRuntimeState } from "../runtime/kartRuntime";
import { KART_CONFIG, KART_WHEEL_POSITIONS } from "../core/kart/kartConfig";
import { createKartPresentation, stepKartPresentation } from "../core/kart/kartPresentation";
import { DriftEffects } from "./DriftEffects";
import { createKartVisualDynamics, stepKartVisualDynamics, createKartSurfaceDynamics, stepKartSurfaceDynamics } from "../assets/kartVisualDynamics";
import { KartBodyModel, KartWheelModel } from "../assets/KartModel";

type KartProps = {
  characterId: CharacterId;
  runtimeRef: RefObject<KartRuntimeState>;
};

export function Kart({ runtimeRef, characterId }: KartProps) {
  const presentationRef = useRef(createKartPresentation());
  const rootRef = useRef<Group>(null);
  const forwardRef = useRef(new Vector3());
  const visualRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const dynamics = useRef(createKartVisualDynamics());
  const dynamicsRevision = useRef(-1);
  const roadDynamics = useRef(createKartSurfaceDynamics());
  const wasAirborne = useRef(false);
  const parentRotation = useRef(new Quaternion());
  const roadEuler = useRef(new Euler(0, 0, 0, "YXZ"));
  const drawnRotation = useRef(new Quaternion());

  useFrame((_, delta) => {
    const visual = visualRef.current;
    const runtime = runtimeRef.current;

    if (!visual || !runtime) {
      return;
    }

    const reset = dynamicsRevision.current !== runtime.poseRevision || runtime.finished;
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
      root.parent.getWorldQuaternion(parentRotation.current);
      roadEuler.current.setFromQuaternion(parentRotation.current, "YXZ");
      const airborne = runtime.stuntProgress > 0;
      stepKartSurfaceDynamics(roadDynamics.current, roadEuler.current.x, roadEuler.current.z,
        delta, reset || airborne || wasAirborne.current !== airborne);
      wasAirborne.current = airborne;
      roadEuler.current.set(roadDynamics.current.pitch, roadEuler.current.y, roadDynamics.current.roll, "YXZ");
      drawnRotation.current.setFromEuler(roadEuler.current);
      // Cancel only the parent's unsmoothed normal in this presentation child.
      root.quaternion.copy(parentRotation.current).invert().multiply(drawnRotation.current);
      // Publish the actual drawn pose for the camera in the same render frame.
      root.getWorldPosition(runtime.renderPosition);
      root.getWorldDirection(forwardRef.current);
      runtime.renderYaw = Math.atan2(forwardRef.current.x, forwardRef.current.z);
    }
    dynamicsRevision.current = runtime.poseRevision;
    stepKartVisualDynamics(dynamics.current, runtime.speed, runtime.steer, runtime.drifting,
      runtime.stuntProgress > 0, runtime.collisionShake, delta, reset);
    // Suspension moves the sprung body only; wheel centres remain on the road.
    visual.rotation.z = runtime.stuntProgress > 0 ? Math.PI * 2 * runtime.stuntProgress : 0;
    const body = bodyRef.current;
    if (body) {
      body.rotation.set(dynamics.current.pitch, 0, dynamics.current.roll);
      body.position.y = dynamics.current.sink;
    }
  }, -1);

  return (
    <group ref={rootRef}>
      <group scale={KART_CONFIG.modelScale} position={[0, -0.43 * (1 - KART_CONFIG.modelScale), 0]}>
      <group ref={visualRef}>
        <group ref={bodyRef}><KartBodyModel characterId={characterId} color="#f2b52e" motionRef={runtimeRef} /></group>
      {KART_WHEEL_POSITIONS.map((position, index) => <KartWheelModel key={index} position={position} motionRef={runtimeRef} />)}
      </group>

      <DriftEffects runtimeRef={runtimeRef} />
      </group>
    </group>
  );
}
