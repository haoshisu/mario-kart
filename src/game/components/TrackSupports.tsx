import { Instance, Instances } from "@react-three/drei";
import { useTrack } from "../track/TrackContext";
import { pointAtTrackOffset } from "../track/trackPath";
import { surfaceOffsetHeight } from "../track/trackSurface";

/** Visible foundations expose elevation and anchor the raised road to the world. */
export function TrackSupports() {
  const track = useTrack();
  const supports = track.samples.filter((sample, index) => index % 9 === 0 && sample.height > 1.6);
  return <group name="elevated-road-foundations">
    <Instances frames={1} limit={supports.length * 2} castShadow receiveShadow>
      <cylinderGeometry args={[.42, .7, 1, 8]} /><meshStandardMaterial color={track.id === "canyon" ? "#9a6555" : "#738ba2"} roughness={.9} />
      {supports.flatMap((sample, index) => [-3.3, 3.3].map((offset) => {
        const [x, z] = pointAtTrackOffset(sample, offset);
        const height = Math.max(.1, surfaceOffsetHeight(sample, offset) - .25);
        return <Instance key={`${index}-${offset}`} position={[x, height / 2, z]} scale={[1, height, 1]} />;
      }))}
    </Instances>
    <Instances frames={1} limit={supports.length} castShadow receiveShadow>
      <boxGeometry /><meshStandardMaterial color={track.id === "canyon" ? "#ad7b62" : "#8aabbc"} roughness={.8} />
      {supports.map((sample, i) => <Instance key={i} position={[sample.position[0], sample.height - .55, sample.position[1]]}
        rotation={[0, Math.atan2(-sample.tangent[0], -sample.tangent[1]), sample.bank]}
        scale={[9.5, .5, .6]} />)}
    </Instances>
  </group>;
}
