import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { MeshBasicMaterial, Group } from "three";
import type { SnapshotBuffer } from "../network/interpolation";

/** Fixed stream ribbons around the followed kart; no particle allocation. */
export function SlipstreamEffects({ playerId, snapshotsRef }: { playerId: string; snapshotsRef: RefObject<SnapshotBuffer> }) {
  const group = useRef<Group>(null);
  const materials = useRef<(MeshBasicMaterial | null)[]>([]);
  useFrame(({ clock }, delta) => {
    const player = snapshotsRef.current.sampleFrame(clock.elapsedTime)?.players.find(player => player.id === playerId);
    if (!group.current || !player) return;
    const draft = player.slipstream, boost = draft.boostRemaining > 0;
    const weight = boost || draft.ready ? 1 : draft.charge;
    group.current.visible = player.status === "racing" && weight > 0;
    for (const material of materials.current) if (material) {
      material.opacity += (weight * .6 - material.opacity) * (1 - Math.exp(-12 * Math.min(delta, .1)));
      material.color.set(boost ? "#ecffbd" : draft.ready ? "#d9ff85" : "#82eaff");
    }
    for (let i = 0; i < group.current.children.length; i++) {
      const ribbon = group.current.children[i];
      const phase = (clock.elapsedTime * (boost ? 3 : 1.8) + i / 6) % 1;
      ribbon.position.z = .3 + phase * 2.8;
      ribbon.scale.z = .5 + weight * .7;
    }
  });
  return <group ref={group} visible={false}>
    {[-.9, .9, -1.02, 1.02, -.84, .84].map((x, i) => <mesh key={i} position={[x, -.12 + (i % 3) * .16, 0]}>
      <boxGeometry args={[.025, .025, 1.2]} />
      <meshBasicMaterial ref={node => { materials.current[i] = node; }} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>)}
  </group>;
}
