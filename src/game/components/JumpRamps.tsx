import { STUNT_CONFIG } from "../core/stunts/stuntSystem";
import { TRACK_CONFIG } from "../track/trackConfig";
import { useTrack } from "../track/TrackContext";

const { width, length, rise } = STUNT_CONFIG;
const vertices = new Float32Array([
  -width / 2, 0, length, width / 2, 0, length,
  -width / 2, rise, 0, width / 2, rise, 0,
  -width / 2, 0, 0, width / 2, 0, 0,
]);
const indices = new Uint16Array([0, 1, 2, 1, 3, 2, 0, 2, 4, 1, 5, 3, 2, 3, 4, 3, 5, 4]);

export function JumpRamps() {
  const track = useTrack();
  return <group name="stunt-jump-ramps">
    {track.ramps.map(ramp => <group key={ramp.id}
      position={[ramp.position[0], ramp.height + TRACK_CONFIG.roadTop + .015, ramp.position[1]]}
      rotation={[ramp.pitch, ramp.yaw, ramp.roll, "YXZ"]}>
      <mesh receiveShadow castShadow>
        <bufferGeometry onUpdate={geometry => geometry.computeVertexNormals()}>
          <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
          <bufferAttribute attach="index" args={[indices, 1]} />
        </bufferGeometry>
        <meshStandardMaterial color={track.accent} emissive={track.accent} emissiveIntensity={.35} roughness={.5} />
      </mesh>
      {[1, 2, 3].map(z => <group key={z} position={[0, rise * (1 - z / length) + .03, z]} rotation={[Math.atan(rise / length), 0, 0]}>
        {[-1, 1].map(side => <mesh key={side} position={[side * .25, 0, 0]} rotation={[0, side * Math.PI / 4, 0]}>
          <boxGeometry args={[.15, .04, .9]} /><meshBasicMaterial color="#ffffff" />
        </mesh>)}
      </group>)}
      {[-1, 1].map(side => <group key={side} position={[side * (width / 2 + .35), 0, length]}>
        <mesh position={[0, .65, 0]}><cylinderGeometry args={[.08, .08, 1.3, 6]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[.65, .65, .12]} /><meshBasicMaterial color={track.accent} /></mesh>
      </group>)}
      {[-1, 1].map(side => <mesh key={side} position={[side * (width / 2 - .08), rise / 2 + .035, length / 2]} rotation={[Math.atan(rise / length), 0, 0]}>
        <boxGeometry args={[.1, .05, Math.hypot(length, rise)]} /><meshBasicMaterial color="#fff29c" />
      </mesh>)}
      <mesh position={[0, rise + .035, 0]}><boxGeometry args={[width, .08, .16]} /><meshBasicMaterial color="#ffffff" /></mesh>
    </group>)}
  </group>;
}
