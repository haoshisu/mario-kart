import { Instance, Instances } from "@react-three/drei";

type TreePlacement = Readonly<{
  position: readonly [number, number];
  scale: number;
  rotation: number;
}>;

const TREES: readonly TreePlacement[] = [
  { position: [-8, -1], scale: 1.15, rotation: 0.2 },
  { position: [-4, 2.4], scale: 0.9, rotation: 1.7 },
  { position: [1.5, -2.6], scale: 1.25, rotation: 0.8 },
  { position: [6.5, 1.2], scale: 1, rotation: 2.4 },
  { position: [29.5, -10], scale: 1.15, rotation: 0.1 },
  { position: [30.5, -4.5], scale: 0.85, rotation: 1.2 },
  { position: [30, 7], scale: 1.3, rotation: 2.5 },
  { position: [27.5, 14], scale: 0.95, rotation: 0.6 },
  { position: [21, 20], scale: 1.1, rotation: 1.8 },
  { position: [10, 21.5], scale: 0.9, rotation: 2.9 },
  { position: [-4, 21], scale: 1.25, rotation: 0.9 },
  { position: [-16, 20.5], scale: 1, rotation: 2.1 },
  { position: [-27, 16.5], scale: 1.2, rotation: 0.4 },
  { position: [-30, 8], scale: 0.85, rotation: 1.5 },
  { position: [-30.5, -4], scale: 1.15, rotation: 2.8 },
  { position: [-27.5, -14], scale: 1, rotation: 0.7 },
  { position: [-17, -20.5], scale: 1.25, rotation: 1.9 },
  { position: [9, -21], scale: 1.05, rotation: 2.6 },
  { position: [20, -20], scale: 0.9, rotation: 0.3 },
];

const ROCKS = [
  [-10.5, 3.9, 0.75, 0.2],
  [9.2, -3.8, 0.55, 1.1],
  [31, 13, 0.85, 0.6],
  [-30, -15.5, 0.7, 2.2],
  [18, 22, 0.6, 1.7],
] as const;

function LowPolyTrees() {
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
        <coneGeometry args={[1, 1.75, 7]} />
        <meshStandardMaterial color="#2f6c3b" flatShading roughness={0.9} />
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
        <coneGeometry args={[0.72, 1.45, 7]} />
        <meshStandardMaterial color="#41834b" flatShading roughness={0.88} />
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
  return (
    <group>
      <LowPolyTrees />
      <TracksideRocks />
      <TracksideTent />
    </group>
  );
}
