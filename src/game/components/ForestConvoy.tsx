import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import { TaiwanBoxes, type TaiwanBox } from "./TaiwanProps";

/** Three original forest cars share geometry rather than tripling draw calls. */
export function ForestConvoy() {
  const props = useMemo(() => {
    const boxes: TaiwanBox[] = [], wheels: Array<readonly [number, number, number]> = [], lamps: Array<readonly [number, number, number]> = [];
    for (const z of [-6, 0, 6]) {
      boxes.push({ position: [0, 1.05, z], scale: [1.4, 1.6, 5], color: "#bb523d" },
        { position: [0, 1.94, z], scale: [1.5, .2, 5.1], color: "#d1c6aa", surface: "metal" },
        { position: [0, 1.3, z - 2.51], scale: [1, .6, .02], color: "#244b55", surface: "glass" },
        { position: [0, .65, z + 2.8], scale: [.16, .16, .9], color: "#454747", surface: "metal" });
      for (const side of [-1, 1]) {
        for (const sz of [-1.5, 0, 1.5]) boxes.push({ position: [side * .71, 1.35, z + sz], scale: [.025, .65, 1], color: "#244b55", surface: "glass" });
        for (const sz of [-1.7, 1.7]) wheels.push([side * .65, .45, z + sz]);
        lamps.push([side * .4, .75, z - 2.52]);
      }
    }
    return { boxes, wheels, lamps };
  }, []);
  return <group name="original-forest-convoy"><TaiwanBoxes boxes={props.boxes} />
    <Instances frames={1} limit={12}><cylinderGeometry args={[.24, .24, .18, 8]} /><meshStandardMaterial color="#293b3e" roughness={.5} />
      {props.wheels.map((p, i) => <Instance key={i} position={[...p]} rotation={[0, 0, Math.PI / 2]} />)}
    </Instances>
    <Instances frames={1} limit={6}><sphereGeometry args={[.1, 8, 5]} /><meshBasicMaterial color="#ffde93" />
      {props.lamps.map((p, i) => <Instance key={i} position={[...p]} />)}
    </Instances>
  </group>;
}
