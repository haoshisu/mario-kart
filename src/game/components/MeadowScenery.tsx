import { surfaceOffsetHeight } from "../track/trackSurface";
import { Instance, Instances } from "@react-three/drei";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import { TRACK_CONFIG } from "../track/trackConfig";
import { useTrack } from "../track/TrackContext";
import { useMemo } from "react";

const HILLS = [[-55, 32, 7], [54, 35, 8], [-40, -28, 7], [32, -28, 8]] as const;
/** All props remain beyond the guardrails; existing collision geometry is unchanged. */
export function MeadowScenery({ themed = false }: { themed?: boolean }) {
  const { samples: TRACK_SAMPLES, race: { FINISH_MARKER }, accent } = useTrack();
  const hills = HILLS.filter(([x, z, size]) => distanceToTrack(x, z, TRACK_SAMPLES) > size + 5);
  const SIGNS = useMemo(() => TRACK_SAMPLES.flatMap((sample, index) => {
    if (index % 12 !== 0) return [];
    // Warn before entering the bend, rather than placing every arrow at its apex.
    const ahead = TRACK_SAMPLES[(index + 24) % TRACK_SAMPLES.length];
    const turn = sample.tangent[0] * ahead.tangent[1] - sample.tangent[1] * ahead.tangent[0];
    if (Math.abs(turn) < .45) return [];
    const side = Math.sign(turn);
    const [x, z] = pointAtTrackOffset(sample, -side * (TRACK_CONFIG.roadWidth / 2 + 1.6));
    return [{ x, z, height: surfaceOffsetHeight(sample, -side * (TRACK_CONFIG.roadWidth / 2 + 1.6)), yaw: Math.atan2(-sample.tangent[0], -sample.tangent[1]), side }];
  }), [TRACK_SAMPLES]);


  return <group>
    {!themed ? <Instances limit={hills.length} frames={1}>
      <sphereGeometry args={[1, 20, 12]} />
      <meshStandardMaterial color="#71c944" roughness={1} />
      {hills.map(([x, z, size]) => <Instance key={`${x}`} position={[x, -2, z]} scale={[size, size * .75, size]} />)}
    </Instances> : null}
    <Instances frames={1} limit={12} castShadow>
      <boxGeometry /><meshStandardMaterial roughness={.65} />
      <group position={[FINISH_MARKER.position[0], 0, FINISH_MARKER.position[1]]} rotation={[0, -Math.PI / 2, 0]}>
        {[-6, 6].map((x) => <Instance key={x} position={[x, 2.8, 0]} scale={[.4, 5.6, .5]} color="#164957" />)}
        <Instance position={[0, 5.2, 0]} scale={[12.4, .85, .65]} color={accent} />
        {Array.from({ length: 9 }, (_, index) => <Instance key={index} position={[(index - 4) * .8, 5.2, -.34]}
          scale={[.38, .45, .03]} color={index % 2 ? "#fff0c8" : "#173e4d"} />)}
      </group>
    </Instances>
    <Instances frames={1} limit={SIGNS.length * 4}>
      <boxGeometry /><meshStandardMaterial roughness={.8} />
      {SIGNS.map(({ x, z, height, yaw, side }) => <group key={`${x}-${z}`} position={[x, height, z]} rotation={[0, yaw, 0]}>
        <Instance position={[0, 1.1, 0]} scale={[.1, 2.2, .1]} color="#294652" />
        <Instance position={[0, 2.2, 0]} scale={[1.8, 1.1, .12]} color="#163e4e" />
        {[-1, 1].map((arm) => <Instance key={arm} position={[0, 2.2 + arm * .2, .08]}
          rotation={[0, 0, arm * side * -.6]} scale={[.85, .22, .05]} color="#ffdb64" />)}
      </group>)}
    </Instances>
    {[-21].map((z) => <group key={z} position={[0, 0, z]}>
      {[0, 1, 2].map((tier) => <mesh key={tier} position={[0, .25 + tier * .45, Math.sign(z) * tier * .6]} receiveShadow>
        <boxGeometry args={[9, .45 + tier * .7, .65]} /><meshStandardMaterial color={tier % 2 ? "#fff0c8" : "#219fa5"} />
      </mesh>)}
    </group>)}
  </group>;
}
