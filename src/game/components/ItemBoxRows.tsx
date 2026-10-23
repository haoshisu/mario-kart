import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Euler, Matrix4, Object3D, type InstancedMesh } from "three";
import { useTrack } from "../track/TrackContext";
import type { SnapshotBuffer } from "../network/interpolation";

/** Two shared draw calls keep wider, denser supply rows affordable on phones. */
export function ItemBoxRows({ snapshotsRef }: { snapshotsRef: RefObject<SnapshotBuffer> }) {
  const { items: { ITEM_BOXES } } = useTrack();
  const bodies = useRef<InstancedMesh>(null), frames = useRef<InstancedMesh>(null);
  const transform = useRef(new Object3D());
  const frameRotation = useRef(new Matrix4().makeRotationFromEuler(new Euler(Math.PI / 4, 0, Math.PI / 4)));
  useFrame(({ clock }) => {
    if (!bodies.current || !frames.current) return;
    const snapshot = snapshotsRef.current.sampleFrame(clock.elapsedTime);
    bodies.current.visible = frames.current.visible = snapshot?.phase === "racing" || snapshot?.phase === "countdown";
    if (!bodies.current.visible) return;
    const pose = transform.current;
    for (let index = 0; index < ITEM_BOXES.length; index++) {
      const box = ITEM_BOXES[index], remaining = snapshot?.items.boxes[index]?.remaining ?? 0;
      pose.position.set(box.position[0], box.height + 1 + Math.sin(clock.elapsedTime * 2 + index) * .12, box.position[1]);
      pose.rotation.set(0, clock.elapsedTime * .7 + index, 0);
      pose.scale.setScalar(remaining > 0 ? .15 : 1);
      pose.updateMatrix();
      bodies.current.setMatrixAt(index, pose.matrix);
      pose.matrix.multiply(frameRotation.current);
      frames.current.setMatrixAt(index, pose.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = frames.current.instanceMatrix.needsUpdate = true;
  });
  return <group name="full-width-item-rows">
    <instancedMesh ref={bodies} args={[undefined, undefined, ITEM_BOXES.length]} frustumCulled={false} castShadow>
      <boxGeometry args={[.7, .7, .7]} />
      <meshStandardMaterial color="#9be9ef" emissive="#159aab" emissiveIntensity={.45} roughness={.25} />
    </instancedMesh>
    <instancedMesh ref={frames} args={[undefined, undefined, ITEM_BOXES.length]} frustumCulled={false}>
      <octahedronGeometry args={[.55]} />
      <meshBasicMaterial color="#fff4a3" wireframe />
    </instancedMesh>
  </group>;
}
