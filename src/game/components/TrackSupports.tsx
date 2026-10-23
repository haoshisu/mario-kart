import { Instance, Instances } from "@react-three/drei";
import { useTrack } from "../track/TrackContext";
import { pointAtTrackOffset } from "../track/trackPath";
import { surfaceOffsetHeight } from "../track/trackSurface";

/** Visible foundations expose elevation and anchor the raised road to the world. */
export function TrackSupports() {
  const track = useTrack();
  const roads = [track.samples, ...track.branches.filter(branch=>!branch.movable).map(branch => branch.samples)];
  const pillars = roads.flatMap((road, r) => road.flatMap((sample, i) => {
    if (i % 9 || sample.height <= 1.6) return [];
    const offset = (r === 0 ? 8.4 : track.branches[r - 1].width) / 2 - .9;
    return [-offset, offset].flatMap(side => {
      const [x, z] = pointAtTrackOffset(sample, side);
      // Bridge piers cannot pass through the road running beneath them.
      if (roads.some(other => other.some(point => sample.height - point.height > 3 && Math.hypot(point.position[0] - x, point.position[1] - z) < 6))) return [];
      return [{ x, z, height: Math.max(.1, surfaceOffsetHeight(sample, side) - .25) }];
    });
  }));
  const supports = track.samples.filter((sample, index) => index % 9 === 0 && sample.height > 1.6);
  return <group name="elevated-road-foundations">
    <Instances frames={1} limit={pillars.length} castShadow receiveShadow>
      <cylinderGeometry args={[.42, .7, 1, 8]} /><meshStandardMaterial color={track.id === "canyon" ? "#9a6555" : "#82877f"} roughness={.9} />
      {pillars.map(({ x, z, height }, index) => <Instance key={index} position={[x, height / 2, z]} scale={[1, height, 1]} />)}
    </Instances>
    <Instances frames={1} limit={supports.length} castShadow receiveShadow>
      <boxGeometry /><meshStandardMaterial color={track.id === "canyon" ? "#ad7b62" : "#979b91"} roughness={.8} />
      {supports.map((sample, i) => <Instance key={i} position={[sample.position[0], sample.height - .55, sample.position[1]]}
        rotation={[0, Math.atan2(-sample.tangent[0], -sample.tangent[1]), sample.bank]}
        scale={[9.5, .5, .6]} />)}
    </Instances>
  </group>;
}
