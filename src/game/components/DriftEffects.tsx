import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group, MeshBasicMaterial } from "three";
import { getDriftTierConfig } from "../core/kart/kartConfig";
import type { KartRuntimeState } from "../runtime/kartRuntime";

type DriftEffectsProps = {
  runtimeRef: RefObject<KartRuntimeState>;
};

export function DriftEffects({ runtimeRef }: DriftEffectsProps) {
  const driftGroupRef = useRef<Group>(null);
  const sparkMaterialRef = useRef<MeshBasicMaterial>(null);
  const otherSparkMaterialRef = useRef<MeshBasicMaterial>(null);
  const smokeRef = useRef<Group>(null);
  const turboGroupRef = useRef<Group>(null);
  const turboMaterialRef = useRef<MeshBasicMaterial>(null);
  const otherTurboMaterialRef = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const runtime = runtimeRef.current;
    const driftGroup = driftGroupRef.current;
    const turboGroup = turboGroupRef.current;

    if (!runtime || !driftGroup || !turboGroup) {
      return;
    }

    driftGroup.visible = runtime.drifting;
    const chargeColor = getDriftTierConfig(runtime.driftTier)?.color ?? "#ffb423";
    const turboColor = getDriftTierConfig(runtime.turboTier)?.color ?? "#46dcff";
    sparkMaterialRef.current?.color.set(chargeColor);
    otherSparkMaterialRef.current?.color.set(chargeColor);
    turboMaterialRef.current?.color.set(turboColor);
    otherTurboMaterialRef.current?.color.set(turboColor);
    if (smokeRef.current) {
      smokeRef.current.visible = runtime.drifting;
      smokeRef.current.children.forEach((puff, index) => {
        const phase = (clock.elapsedTime * 2 + Math.floor(index / 2) / 3) % 1;
        puff.position.z = 0.8 + phase * 1.8;
        puff.position.y = -0.22 + phase * 0.4;
        puff.scale.setScalar(0.5 + phase);
      });
    }
    driftGroup.scale.setScalar(
      1 + runtime.driftTier * 0.12 + Math.sin(clock.elapsedTime * 28) * 0.12,
    );
    turboGroup.visible = runtime.turboRemaining > 0;
    turboGroup.scale.z = 0.8 + Math.sin(clock.elapsedTime * 36) * 0.22;
  });

  return (
    <>
      <group ref={driftGroupRef} visible={false}>
        {[-0.62, 0.62].map((x) => (
          <group key={x} position={[x, -0.27, 0.85]}>
            <mesh>
              <octahedronGeometry args={[0.2, 0]} />
              <meshBasicMaterial ref={x < 0 ? sparkMaterialRef : otherSparkMaterialRef} color="#ffb423" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.08, 0.2]}>
              <dodecahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial color="#d8e0dc" opacity={0.58} transparent />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={smokeRef} visible={false}>
        {[-0.72, 0.72, -0.72, 0.72, -0.72, 0.72].map((x, index) => (
          <mesh key={index} position={[x, -0.22, 0.8]}>
            <dodecahedronGeometry args={[0.23, 0]} />
            <meshStandardMaterial color="#d8e0dc" opacity={0.28} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={turboGroupRef} visible={false}>
        {[-0.34, 0.34].map((x) => (
          <mesh key={x} position={[x, -0.02, 1.08]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.13, 0.6, 6]} />
            <meshBasicMaterial
              ref={x < 0 ? turboMaterialRef : otherTurboMaterialRef}
              color="#46dcff"
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
