import { TracksideResidents } from "./TracksideResidents";
import { ThemedScenery } from "./ThemedScenery";
import { useTrack } from "../track/TrackContext";
import { TRACK_SAMPLES, pointAtTrackOffset, distanceToTrack } from "../track/trackPath";
import { Instance, Instances } from "@react-three/drei";
import { ValleyLandmarks } from "./ValleyLandmarks";
import { FestivalScenery } from "./FestivalScenery";
import { MeadowScenery } from "./MeadowScenery";

type TreePlacement = Readonly<{
  position: readonly [number, number];
  scale: number;
  rotation: number;
}>;

const TREES: readonly TreePlacement[] = TRACK_SAMPLES.flatMap((sample, index) => {
  if (index % 9 !== 0) return [];
  return [-1, 1].flatMap((side) => {
    const position = pointAtTrackOffset(sample, side * (8 + index % 3));
    if (distanceToTrack(...position) < 7 || Math.hypot(position[0] + 7, position[1] + 10.5) < 9) return [];
    return [{ position, scale: .9 + (index % 4) * .16, rotation: index * .7 }];
  });
});

const ROCKS = [
  [-10.5, 3.9, 0.75, 0.2],
  [9.2, -3.8, 0.55, 1.1],
  [31, 13, 0.85, 0.6],
  [-30, -15.5, 0.7, 2.2],
  [18, 22, 0.6, 1.7],
].filter(([x, z]) => distanceToTrack(x, z) > 7);

function OrchardTrees() {
  return (
    <group>
      <Instances castShadow frames={1} limit={TREES.length} receiveShadow>
        <cylinderGeometry args={[0.2, 0.28, 1.5, 6]} />
        <meshStandardMaterial color="#70452b" flatShading roughness={1} />
        {TREES.map((tree, index) => (
          <Instance
            key={`trunk-${index}`}
            position={[tree.position[0], 0.75 * tree.scale, tree.position[1]]}
            rotation={[0, tree.rotation, 0]}
            scale={tree.scale}
          />
        ))}
      </Instances>

      <Instances castShadow frames={1} limit={TREES.length}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#48ad39" roughness={0.9} />
        {TREES.map((tree, index) => (
          <Instance
            key={`lower-crown-${index}`}
            position={[tree.position[0], 1.9 * tree.scale, tree.position[1]]}
            rotation={[0, tree.rotation, 0]}
            scale={tree.scale}
          />
        ))}
      </Instances>

      <Instances castShadow frames={1} limit={TREES.length}>
        <sphereGeometry args={[0.78, 12, 8]} />
        <meshStandardMaterial color="#80ce42" roughness={0.88} />
        {TREES.map((tree, index) => (
          <Instance
            key={`upper-crown-${index}`}
            position={[tree.position[0], 2.85 * tree.scale, tree.position[1]]}
            rotation={[0, tree.rotation + 0.35, 0]}
            scale={tree.scale}
          />
        ))}
      </Instances>
    </group>
  );
}

function TracksideRocks() {
  return (
    <Instances castShadow frames={1} limit={ROCKS.length} receiveShadow>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#8b8979" flatShading roughness={0.98} />
      {ROCKS.map(([x, z, scale, rotation], index) => (
        <Instance
          key={`rock-${index}`}
          position={[x, scale * 0.45, z]}
          rotation={[0.12, rotation, 0.08]}
          scale={[scale * 1.25, scale * 0.75, scale]}
        />
      ))}
    </Instances>
  );
}

function TracksideTent() {
  return (
    <group position={[0, 0, -18.5]}>
      {[-1.25, 1.25].map((x) => (
        <mesh key={x} castShadow position={[x, 1.1, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 2.2, 6]} />
          <meshStandardMaterial color="#ded8c9" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 2.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.2, 1.05, 4]} />
        <meshStandardMaterial color="#f0b62c" flatShading roughness={0.72} />
      </mesh>
      <mesh castShadow position={[0, 0.65, 0]}>
        <boxGeometry args={[2.2, 1.2, 0.15]} />
        <meshStandardMaterial color="#26333a" roughness={0.86} />
      </mesh>
    </group>
  );
}

/** Non-colliding scenery is kept independent from the driveable track. */
export function TrackDecorations() {
  const track = useTrack();
  if (track.id !== "meadow") return <><ThemedScenery /><TracksideResidents /></>;
  return (
    <group>
      <TracksideResidents />
      <OrchardTrees />
      <TracksideRocks />
      <TracksideTent />
      <MeadowScenery />
      <FestivalScenery />
      <ValleyLandmarks />
    </group>
  );
}
