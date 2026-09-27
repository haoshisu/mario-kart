import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Vector3, type Group } from "three";
import type { KartRuntimeState } from "../runtime/kartRuntime";
import { KART_CONFIG, KART_WHEEL_POSITIONS } from "../core/kart/kartConfig";
import { createKartPresentation, stepKartPresentation } from "../core/kart/kartPresentation";
import { DriftEffects } from "./DriftEffects";

type KartProps = {
  runtimeRef: RefObject<KartRuntimeState>;
};

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <mesh castShadow position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[KART_CONFIG.wheels.radius, KART_CONFIG.wheels.radius, 0.24, 10]} />
      <meshStandardMaterial color="#17191b" roughness={0.72} />
    </mesh>
  );
}

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
      <group ref={visualRef}>
      <mesh castShadow position={[0, 0, 0.08]} receiveShadow>
        <boxGeometry args={[1.3, 0.34, 1.75]} />
        <meshStandardMaterial color="#f2b52e" metalness={0.08} roughness={0.52} />
      </mesh>
      <mesh castShadow position={[0, 0.13, -0.68]}>
        <boxGeometry args={[1.12, 0.26, 0.56]} />
        <meshStandardMaterial color="#ef5b32" metalness={0.06} roughness={0.48} />
      </mesh>
      <mesh castShadow position={[0, 0.35, 0.22]}>
        <boxGeometry args={[0.78, 0.42, 0.68]} />
        <meshStandardMaterial color="#263c4b" roughness={0.62} />
      </mesh>
      <mesh castShadow position={[0, 0.68, 0.16]}>
        <sphereGeometry args={[0.27, 12, 8]} />
        <meshStandardMaterial color="#f4d1ad" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.39, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.045, 8, 14]} />
        <meshStandardMaterial color="#202326" roughness={0.66} />
      </mesh>

      </group>
      {KART_WHEEL_POSITIONS.map((position, index) => <Wheel key={index} position={position} />)}

      <DriftEffects runtimeRef={runtimeRef} />
    </group>
  );
}
