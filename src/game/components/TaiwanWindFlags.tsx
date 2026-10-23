import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group } from "three";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import { COURSE_MECHANICS } from "../track/courseDesign";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import { routeLength, sampleAtDistance } from "../track/trackPlacement";

/** Cloth on the exposed ridge previews the same constant wind direction that
 * affects steering; shared simulation time animates flutter, not wind physics.
 */
export function TaiwanWindFlags() {
  const track = useTrack(), runtime = useTrackRuntimeRef(), refs = useRef<Array<Group | null>>([]);
  const points = useMemo(() => {
    if (track.id !== "alishan") return [];
    const mechanic = COURSE_MECHANICS.alishan, length = routeLength(track.race.RACE_ROUTE_SAMPLES);
    return [mechanic.from - .012, mechanic.from + .013, mechanic.to - .012].flatMap(f => {
      const sample = sampleAtDistance(track.race.RACE_ROUTE_SAMPLES, f * length);
      const [x, z] = pointAtTrackOffset(sample, -6.8);
      if ([track.samples, ...track.branches.map(b => b.samples)].some(road => distanceToTrack(x, z, road, { closed: road === track.samples }) < 5.8)) return [];
      return [{ position: [x, sample.height, z] as const, yaw: Math.atan2(sample.normal[0], sample.normal[1]) }];
    });
  }, [track]);
  useFrame(({ clock }) => {
    const seconds = runtime.current.seconds || clock.elapsedTime;
    refs.current.forEach((flag, i) => { if (flag) { flag.rotation.y = Math.sin(seconds * 5 + i * 2) * .14; flag.rotation.x = Math.sin(seconds * 7 + i) * .08; } });
  });
  return <group name="alishan-wind-forecast">{points.map((p, i) => <group key={i} position={[...p.position]} rotation={[0, p.yaw, 0]}>
    <mesh position={[0, 1.8, 0]}><cylinderGeometry args={[.07, .09, 3.6, 6]} /><meshStandardMaterial color="#79644d" roughness={.85} /></mesh>
    <group position={[0, 3.3, 0]} ref={node => { refs.current[i] = node; }}>
      <mesh position={[0, 0, .8]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.6, .45, 3, 1]} /><meshStandardMaterial color="#d7b973" side={DoubleSide} roughness={1} /></mesh>
    </group>
  </group>)}</group>;
}
