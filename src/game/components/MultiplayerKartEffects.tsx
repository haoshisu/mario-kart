import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group, MeshBasicMaterial, Mesh } from "three";
import { getDriftTierConfig } from "../core/kart/kartConfig";
import type { SnapshotBuffer } from "../network/interpolation";

/** Fixed visual pool per kart: no particle creation or React updates inside the frame loop. */
export function MultiplayerKartEffects({ playerId, snapshotsRef }: {
  playerId: string; snapshotsRef: RefObject<SnapshotBuffer>;
}) {
  const smoke = useRef<Group>(null);
  const sparks = useRef<Group>(null);
  const flames = useRef<Group>(null);
  const shield = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  const flashMaterial = useRef<MeshBasicMaterial>(null);
  const sparkMaterials = useRef<(MeshBasicMaterial | null)[]>([]);
  const lastImpact = useRef(0);
  const flashRemaining = useRef(0);
  useFrame(({ clock }, delta) => {
    const player = snapshotsRef.current.sampleFrame(clock.elapsedTime)?.players.find((entry) => entry.id === playerId);
    if (!player) return;
    const time = clock.elapsedTime;
    if (smoke.current) {
      smoke.current.visible = player.drifting || player.spinOutRemaining > 0;
      for (let index = 0; index < smoke.current.children.length; index += 1) {
        const puff = smoke.current.children[index];
        const phase = (time * 2 + Math.floor(index / 2) / 3) % 1;
        puff.position.y = -0.2 + phase * 0.45;
        puff.position.z = 0.8 + phase * 1.5;
        puff.scale.setScalar(0.4 + phase);
      }
    }
    if (sparks.current) {
      sparks.current.visible = player.drifting;
      sparks.current.scale.setScalar(0.8 + player.driftTier * 0.15 + Math.sin(time * 25) * 0.15);
      for (const material of sparkMaterials.current) material?.color.set(getDriftTierConfig(player.driftTier)?.color ?? "#ffb423");
    }
    if (flames.current) {
      flames.current.visible = player.item.boostRemaining > 0 || player.turboTier > 0;
      flames.current.scale.z = 1.8 + Math.sin(time * 36) * 0.2;
    }
    if (shield.current) {
      shield.current.visible = player.item.shieldRemaining > 0 || player.item.immunityRemaining > 0;
      shield.current.scale.setScalar(player.item.shieldRemaining > 0 ? 1 : 0.95 + Math.sin(time * 12) * 0.04);
      shield.current.rotation.y = time;
    }
    if (lastImpact.current !== player.impactRevision) {
      lastImpact.current = player.impactRevision;
      flashRemaining.current = 0.6;
      flashMaterial.current?.color.set(player.impactKind === "item" ? "#ee7dff" : player.impactKind === "wall" ? "#ffc15a" : "#ffffff");
    }
    flashRemaining.current = Math.max(0, flashRemaining.current - Math.min(delta, 0.1));
    if (flash.current) {
      flash.current.visible = flashRemaining.current > 0;
      flash.current.scale.setScalar(1 + (0.6 - flashRemaining.current) * 3);
    }
    if (flashMaterial.current) flashMaterial.current.opacity = flashRemaining.current * 1.8;
  });
  return <>
    <group ref={smoke} visible={false}>
      {[-0.7, 0.7, -0.7, 0.7, -0.7, 0.7].map((x, index) => <mesh key={index} position={[x, -0.2, 0.8]}>
        <dodecahedronGeometry args={[0.23, 0]} /><meshStandardMaterial color="#d9e4de" transparent opacity={0.3} depthWrite={false} />
      </mesh>)}
    </group>
    <group ref={sparks} visible={false}>
      {[-0.65, 0.65].map((x, index) => <mesh key={x} position={[x, -0.2, 0.9]}>
        <octahedronGeometry args={[0.2]} /><meshBasicMaterial toneMapped={false}
          ref={(node) => { sparkMaterials.current[index] = node; }} />
      </mesh>)}
    </group>
    <group ref={flames} visible={false}>
      {[-0.35, 0.35].map((x) => <mesh key={x} position={[x, 0, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 1.8, 8]} /><meshBasicMaterial color="#68edff" toneMapped={false} />
      </mesh>)}
    </group>
    <group ref={shield} visible={false} position={[0, .15, 0]}>
      <mesh><sphereGeometry args={[1.55, 20, 12]} /><meshBasicMaterial color="#4eeaff" transparent opacity={.16} depthWrite={false} /></mesh>
      {[0, Math.PI / 2].map((angle) => <mesh key={angle} rotation={[angle, 0, .4]}>
        <torusGeometry args={[1.55, .035, 5, 32]} /><meshBasicMaterial color="#bbffff" toneMapped={false} />
      </mesh>)}
    </group>
    <mesh ref={flash} visible={false} position={[0, 0.1, 0]}>
      <icosahedronGeometry args={[1.2, 0]} /><meshBasicMaterial ref={flashMaterial} transparent opacity={0} wireframe depthWrite={false} toneMapped={false} />
    </mesh>
  </>;
}
