import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import { surfaceTexture } from "../rendering/surfaceTextures";
import { TaiwanBoxes, type TaiwanBox } from "./TaiwanProps";

/** Layered cedar crowns and exposed trunks retain readable forest silhouettes. */
export function TaiwanForest({ trees }: { trees: TaiwanBox[] }) {
  const { trunks, crowns } = useMemo(() => ({
    trunks: trees.map(tree => ({ position: [tree.position[0], tree.position[1] + tree.scale[1] / 2, tree.position[2]] as const,
      scale: [.28, tree.scale[1], .28] as const, color: "#625242", surface: "wood" as const })),
    crowns: trees.flatMap(tree => [0, 1, 2, 3].map(tier => ({
      position: [tree.position[0], tree.position[1] + tree.scale[1] * (.43 + tier * .17), tree.position[2]] as const,
      scale: [2.3 - tier * .45, tree.scale[1] * .4, 2.3 - tier * .45] as const,
      color: tree.color, yaw: tier * .43,
    }))),
  }), [trees]);
  if (!trees.length) return null;
  return <group>
    <TaiwanBoxes boxes={trunks} />
    <Instances frames={1} limit={crowns.length} castShadow receiveShadow>
      <coneGeometry args={[1, 1, 12, 2]} />
      <meshStandardMaterial map={surfaceTexture("grass")} roughness={1} />
      {crowns.map((crown, i) => <Instance key={i} position={[...crown.position]} scale={[...crown.scale]} rotation={[0, crown.yaw, 0]} color={crown.color} />)}
    </Instances>
  </group>;
}
