import { Instance, Instances } from "@react-three/drei";

const COTTAGES = [
  { x: -27, z: 8, color: "#f9d59a", roof: "#ef835d" },
  { x: -21, z: 13, color: "#c6e6e0", roof: "#328f9e" },
  { x: -29, z: 17, color: "#f5cec6", roof: "#bf6381" },
] as const;

/** Infield landmarks identify the long orchard bend and village return. */
export function ValleyLandmarks() {
  return <group>
    <group position={[25, 0, 7]}>
      <mesh position={[0, -.18, 0]} scale={[10, .24, 7]} receiveShadow>
        <sphereGeometry args={[1, 32, 12]} /><meshStandardMaterial color="#f2d997" roughness={1} />
      </mesh>
      <mesh position={[0, .05, 0]} scale={[9.3, .06, 6.3]}>
        <sphereGeometry args={[1, 32, 12]} /><meshStandardMaterial color="#48bdce" roughness={.3} metalness={.12} />
      </mesh>
      {[-2, 1, 3].map((z) => <mesh key={z} position={[z, .12, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.4, .14, 1]}>
        <circleGeometry args={[1, 24]} /><meshBasicMaterial color="#b8efe9" />
      </mesh>)}
    </group>
    <Instances frames={1} limit={COTTAGES.length} castShadow receiveShadow>
      <boxGeometry args={[3.4, 3.2, 3.4]} /><meshStandardMaterial roughness={.85} />
      {COTTAGES.map((house) => <Instance key={house.x} position={[house.x, 1.6, house.z]} color={house.color} />)}
    </Instances>
    <Instances frames={1} limit={COTTAGES.length} castShadow>
      <coneGeometry args={[3, 2.1, 4]} /><meshStandardMaterial roughness={.75} />
      {COTTAGES.map((house) => <Instance key={house.x} position={[house.x, 4.15, house.z]} rotation={[0, Math.PI / 4, 0]} color={house.roof} />)}
    </Instances>
    <Instances frames={1} limit={COTTAGES.length * 2}>
      <boxGeometry args={[.7, 1, .08]} /><meshStandardMaterial color="#267582" />
      {COTTAGES.flatMap((house) => [-1, 1].map((side) => <Instance key={`${house.x}-${side}`} position={[house.x + side * .9, 1.9, house.z - 1.74]} />))}
    </Instances>
    <Instances frames={1} limit={COTTAGES.length}>
      <boxGeometry args={[.6, 1.6, .08]} /><meshStandardMaterial color="#9b6743" />
      {COTTAGES.map((house) => <Instance key={house.x} position={[house.x, .8, house.z - 1.74]} />)}
    </Instances>
  </group>;
}
