import { JumpRamps } from "./JumpRamps";
import { sampleTrackSurface, createSurfaceResult } from "../track/trackSurface";
import { useTrack } from "../track/TrackContext";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group } from "three";
import { ITEM_CONFIG } from "../core/items/itemConfig";
import type { SnapshotBuffer } from "../network/interpolation";
import { BoostPads } from "./BoostPads";

export function ItemWorld({ snapshotsRef }: { snapshotsRef: RefObject<SnapshotBuffer> }) {
  const track = useTrack();
  const { items: { ITEM_BOXES } } = track;
  const surface = useRef(createSurfaceResult());
  const boxesRef = useRef<(Group | null)[]>([]);
  const shotsRef = useRef<(Group | null)[]>([]);
  const trapsRef = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const snapshot = snapshotsRef.current.sampleFrame(clock.elapsedTime);
    for (let index = 0; index < ITEM_BOXES.length; index += 1) {
      const group = boxesRef.current[index];
      if (!group) continue;
      group.visible = snapshot?.phase === "racing" || snapshot?.phase === "countdown";
      const remaining = snapshot?.items.boxes[index]?.remaining ?? 0;
      group.scale.setScalar(remaining > 0 ? 0.15 : 1);
      group.rotation.y = clock.elapsedTime * 0.7 + index;
      group.position.y = ITEM_BOXES[index].height + 1 + Math.sin(clock.elapsedTime * 2 + index) * 0.12;
    }
    for (let index = 0; index < ITEM_CONFIG.maximumProjectiles; index += 1) {
      const group = shotsRef.current[index];
      if (!group) continue;
      const shot = snapshot?.items.projectiles[index];
      group.visible = !!shot;
      if (!shot) continue;
      group.position.set(shot.position[0], sampleTrackSurface(...shot.position, track.samples, surface.current).height + 0.75, shot.position[1]);
      group.rotation.y = shot.yaw;
      group.children[0].visible = shot.kind === "disc";
      group.children[1].visible = shot.kind === "orb";
    }
    for (let index = 0; index < ITEM_CONFIG.maximumTraps; index += 1) {
      const group = trapsRef.current[index];
      if (!group) continue;
      const trap = snapshot?.items.traps[index];
      group.visible = !!trap;
      if (!trap) continue;
      group.position.set(trap.position[0], sampleTrackSurface(...trap.position, track.samples, surface.current).height + 0.2, trap.position[1]);
      group.rotation.y = clock.elapsedTime * 2;
    }
  });
  return <group name="authoritative-item-world">
    {ITEM_BOXES.map((box, index) => <group key={box.id} position={[box.position[0], box.height + 1, box.position[1]]}
      ref={(node) => { boxesRef.current[index] = node; }}>
      <mesh castShadow><boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial color="#9be9ef" emissive="#159aab" emissiveIntensity={0.45} roughness={0.25} />
      </mesh>
      <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}><octahedronGeometry args={[0.55]} />
        <meshBasicMaterial color="#fff4a3" wireframe />
      </mesh>
    </group>)}
    <BoostPads />
      <JumpRamps />
    {Array.from({ length: ITEM_CONFIG.maximumProjectiles }, (_, index) => <group key={`shot-${index}`} visible={false}
      ref={(node) => { shotsRef.current[index] = node; }}>
      <group>
        <mesh><cylinderGeometry args={[0.65, 0.65, 0.2, 16]} /><meshStandardMaterial color="#ffba49" emissive="#e75b16" emissiveIntensity={1} /></mesh>
        <mesh position={[0, 0.08, 0]}><octahedronGeometry args={[0.2]} /><meshBasicMaterial color="#fff6b5" /></mesh>
      </group>
      <group>
        <mesh><icosahedronGeometry args={[0.5, 1]} /><meshStandardMaterial color="#52eaff" emissive="#12b9dd" emissiveIntensity={1.2} /></mesh>
        <mesh rotation={[Math.PI / 3, 0, 0]}><torusGeometry args={[0.66, 0.07, 6, 20]} /><meshBasicMaterial color="#dbffff" /></mesh>
      </group>
      <mesh position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 2.4, 8]} /><meshBasicMaterial color="#fff4c3" transparent opacity={0.6} />
      </mesh>
    </group>)}
    {Array.from({ length: ITEM_CONFIG.maximumTraps }, (_, index) => <group key={index} visible={false}
      ref={(node) => { trapsRef.current[index] = node; }}>
      <mesh><cylinderGeometry args={[ITEM_CONFIG.trapRadius, ITEM_CONFIG.trapRadius, 0.12, 12]} />
        <meshStandardMaterial color="#bd4ee9" emissive="#721290" emissiveIntensity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[ITEM_CONFIG.trapRadius + .12, .07, 6, 24]} /><meshBasicMaterial color="#ffadff" toneMapped={false} /></mesh>
      <mesh position={[0, 0.45, 0]}><octahedronGeometry args={[0.32]} />
        <meshStandardMaterial color="#ffe3ff" emissive="#f697ff" emissiveIntensity={0.7} />
      </mesh>
    </group>)}
  </group>;
}
