import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { useTrack } from "../track/TrackContext";
import { createCircuitSection } from "../track/circuitSections";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";

const PALETTE = {
  tainan: { frame: "#bc7861", glow: "#ffe1a4", hill: "#849b70" },
  taichung: { frame: "#e1d8bc", glow: "#acead6", hill: "#73a981" },
  taipei: { frame: "#b66855", glow: "#ffe2aa", hill: "#365951" },
  jiufen: { frame: "#796955", glow: "#e6bd7d", hill: "#3c6052" },
  kaohsiung: { frame: "#e8bc7d", glow: "#6bd5c5", hill: "#347d87" },
  alishan: { frame: "#886a49", glow: "#ffe0a0", hill: "#39654c" },
  forest: { frame: "#986b43", glow: "#c6f884", hill: "#347354" },
  clockwork: { frame: "#b7844d", glow: "#77f7e0", hill: "#565b70" },
  volcano: { frame: "#59434f", glow: "#ffb062", hill: "#59454e" },
  meadow: { frame: "#fff3bb", glow: "#ff97cb", hill: "#63c97a" },
  harbor: { frame: "#202b58", glow: "#40f6ef", hill: "#456591" },
  canyon: { frame: "#d76445", glow: "#ffcf64", hill: "#e68b56" },
  aurora: { frame: "#c6e9ff", glow: "#77ffdc", hill: "#91bde3" },
} as const;

/** Original course-scale landmarks, with all supports outside the guardrails. */
export function CircuitSetPieces() {
  const track = useTrack();
  const colors = PALETTE[track.id];
  const section = useMemo(() => createCircuitSection(track.id, track.race.RACE_ROUTE_SAMPLES, track.branches), [track]);
  const hills = useMemo(() => track.samples.flatMap((sample, index) => {
    if (index % 27) return [];
    return [-1, 1].flatMap(side => {
      const [x, z] = pointAtTrackOffset(sample, side * 17);
      return [track.samples, ...track.branches.map(branch => branch.samples)].every(road => distanceToTrack(x, z, road, { closed: road === track.samples }) > 12)
        ? [{ x, z, size: 4 + index % 4 }] : [];
    });
  }), [track]);
  const wheels = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!wheels.current) return;
    for (const tower of wheels.current.children) {
      const rotor = tower.children[1];
      if (rotor) rotor.rotation.z += Math.min(delta, .05) * .55;
    }
  });
  return <group name={`${track.id}-signature-passage`}>
    <Instances frames={1} limit={hills.length} castShadow receiveShadow>
      <sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={colors.hill} roughness={.9} />
      {hills.map((hill, index) => <Instance key={index} position={[hill.x, -1, hill.z]}
        scale={[hill.size, hill.size * .7, hill.size]} />)}
    </Instances>
    {section.frames.map((frame, index) => <group key={index} position={frame.position}
      rotation={[frame.pitch, frame.yaw, frame.roll, "YXZ"]}>
      {track.id === "canyon" ? <>
        {[-6.8, 6.8].map(x => <mesh key={x} position={[x, 3, 0]} castShadow>
          <cylinderGeometry args={[.9, 1.3, 6, 7]} /><meshStandardMaterial color={colors.frame} flatShading />
        </mesh>)}
        <mesh position={[0, 6.5, 0]} castShadow><boxGeometry args={[15.5, 1.2, 2]} />
          <meshStandardMaterial color={colors.frame} roughness={1} />
        </mesh>
        <mesh position={[0, 6.6, 1.03]}><boxGeometry args={[11, .16, .06]} />
          <meshBasicMaterial color={colors.glow} />
        </mesh>
      </> : <>
        <mesh castShadow><torusGeometry args={[6.3, track.id === "harbor" ? .32 : .45, 8, 32, Math.PI]} />
          <meshStandardMaterial color={colors.frame} roughness={.55} metalness={track.id === "harbor" ? .5 : 0} />
        </mesh>
        <mesh position={[0, 0, .5]}><torusGeometry args={[6.3, .085, 6, 32, Math.PI]} />
          <meshBasicMaterial color={colors.glow} toneMapped={false} />
        </mesh>
        {track.id === "harbor" ? <>
          {[-6.3, 6.3].map(x => <mesh key={x} position={[x, 1.5, 0]}>
            <boxGeometry args={[.4, 3, section.spacing]} /><meshStandardMaterial color="#253452" />
          </mesh>)}
          <mesh position={[0, 6.4, 0]}><boxGeometry args={[9, .25, section.spacing]} /><meshStandardMaterial color="#253452" /></mesh>
        </> : null}
      </>}
      {track.id === "meadow" ? [-6.3, 6.3].map(x => <group key={x} position={[x, 2.6, 0]}>
        {[0, 1, 2, 3, 4].map(petal => <mesh key={petal} position={[Math.cos(petal * Math.PI * .4) * .8, Math.sin(petal * Math.PI * .4) * .8, 0]} scale={[.65, .65, .25]}>
          <sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={index % 2 ? "#f7b5cf" : "#ffe17a"} />
        </mesh>)}
        <mesh position={[0, 0, .2]}><sphereGeometry args={[.45, 10, 6]} /><meshStandardMaterial color="#fffce0" /></mesh>
      </group>) : null}
      {track.id === "aurora" ? [-6.4, 6.4].map(x => <mesh key={x} position={[x, 2, 0]} scale={[1, 2.3, 1]}>
        <octahedronGeometry args={[1.3]} /><meshStandardMaterial color={index % 2 ? "#c6bbff" : "#b9fff1"} emissive={colors.glow} emissiveIntensity={.35} roughness={.2} metalness={.2} />
      </mesh>) : null}
      <mesh position={[0, 7.4, 0]} rotation={[0, 0, Math.PI / 4]}><octahedronGeometry args={[.5]} /><meshBasicMaterial color={colors.glow} /></mesh>
    </group>)}
    {track.id === "meadow" ? <group ref={wheels}>
      {section.frames.filter((_, index) => index % 3 === 0).map((frame, index) => <group key={index}
        position={frame.position} rotation={[0, frame.yaw, 0]}>
        <mesh position={[index % 2 ? -10 : 10, 3.6, 0]} castShadow>
          <cylinderGeometry args={[.65, 1.3, 7.2, 8]} /><meshStandardMaterial color="#fff2c9" />
        </mesh>
        <group position={[index % 2 ? -10 : 10, 6.5, 1]}>
          {[0, 1, 2, 3].map(blade => <group key={blade} rotation={[0, 0, blade * Math.PI / 2]}>
            <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[.6, 3.2, .16]} /><meshStandardMaterial color={index % 2 ? "#ffc3d7" : "#ffe28b"} /></mesh>
          </group>)}
          <mesh><sphereGeometry args={[.4, 10, 6]} /><meshStandardMaterial color="#d3775d" /></mesh>
        </group>
      </group>)}
    </group> : null}
  </group>;
}
