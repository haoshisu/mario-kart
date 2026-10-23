import { AlishanWorld } from "./AlishanWorld";
import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import type { Group } from "three";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import type { TaiwanTrackId } from "../track/taiwanTracks";
import { architecturePlacements } from "../track/taiwanArchitecture";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import { routeLength, sampleAtDistance } from "../track/trackPlacement";
import { PARK_OBSTACLE_FRACTIONS } from "../track/themeParks";
import { COURSE_MECHANICS } from "../track/courseDesign";
import { TaiwanBoxes, type TaiwanBox } from "./TaiwanProps";
import { TaiwanCityDetails } from "./TaiwanCityDetails";
import { TaiwanArchitecture } from "./TaiwanArchitecture";
import { TaiwanDistantBuildings } from "./TaiwanDistantBuildings";
import { CoastalWorld } from "./CoastalWorld";
import { TaipeiWorld } from "./TaipeiWorld";
import { TaiwanSky } from "./TaiwanSky";
import { TaiwanPlatforms } from "./TaiwanPlatforms";
import { TaiwanRootSoil } from "./TaiwanRootSoil";
import { TaiwanTerrain } from "./TaiwanTerrain";
import { TaiwanWindFlags } from "./TaiwanWindFlags";
import { TaiwanSpectacle } from "./TaiwanSpectacle";
import type { SnapshotBuffer } from "../network/interpolation";
import { NETWORK_CONFIG } from "../network/networkConfig";

export function TaiwanScenery({ id, snapshotsRef }: { id: TaiwanTrackId; snapshotsRef?: RefObject<SnapshotBuffer> }) {
  const track = useTrack(), runtime = useTrackRuntimeRef(), surf = useRef<Group>(null), clouds = useRef<Group>(null);
  const props = useMemo(() => {
    const route = track.race.RACE_ROUTE_SAMPLES, length = routeLength(route);
    const roads = [track.samples, ...track.branches.map(b => b.samples)];
    const clear = (x: number, z: number, radius: number) => roads.every(road => distanceToTrack(x, z, road, { closed: road === track.samples }) > radius + 5);
    const architecture = architecturePlacements(track, id), boxes: TaiwanBox[] = [], lights: TaiwanBox[] = [], tea: TaiwanBox[] = [];
    for (const p of architecture) {
      if (p.module === "warehouse") boxes.push({ position: [p.position[0], p.position[1] - .25, p.position[2]], scale: [14, .56, 16], rotation: [0, p.yaw, 0], color: "#819087", surface: "concrete" });
      if (p.position[1] > .5 && !p.portal && p.module !== "cedar") boxes.push({ position: [p.position[0], p.position[1] / 2, p.position[2]], scale: [p.module === "tower" ? 27 : p.module === "ocean" ? 34 : p.module === "warehouse" ? 16 : 9.4, p.position[1], p.module === "tower" ? 27 : p.module === "warehouse" ? 16 : 8.4], rotation: [0, p.yaw, 0], color: id === "jiufen" ? "#89745e" : "#74847c", surface: "concrete" });
    }
    for (let d = 12, i = 0; d < length; d += 20, i++) {
      const s = sampleAtDistance(route, d), f = s.raceProgress;
      for (const side of [-1, 1]) {
        const [x, z] = pointAtTrackOffset(s, side * 6.6);
        if (!clear(x, z, .35)) continue;
        boxes.push({ position: [x, s.height + 2.1, z], scale: [.12, 4.2, .12], color: id === "alishan" ? "#6a513c" : "#53666b", surface: id === "alishan" ? "wood" : "metal" });
        boxes.push({ position: [x, s.height + 4.1, z], scale: [.65, .2, .65], color: "#354b51", surface: "metal" });
        lights.push({ position: [x, s.height + 3.94, z], scale: [.47, .08, .47], color: "#ffca83" });
        if (id === "taipei" && f > .73 && f < .875) {
          const [mx, mz] = pointAtTrackOffset(s, side * 8.3);
          if (clear(mx, mz, 2)) {
            boxes.push({ position: [mx, s.height + .8, mz], scale: [2, 1.6, 3], color: i % 2 ? "#97834f" : "#b1634c", surface: "wood" });
            boxes.push({ position: [mx, s.height + 2.7, mz], scale: [2.7, .15, 3.8], color: i % 2 ? "#b56b47" : "#56897d", surface: "metal" });
            lights.push({ position: [mx, s.height + 2.55, mz], scale: [1.9, .06, 2.5], color: "#ffc27d" });
          }
        }
        if (id === "alishan" && (f < .28 || f > .85)) for (let row = 0; row < 4; row++) {
          const [tx, tz] = pointAtTrackOffset(s, side * (11 + row * 2.1));
          if (clear(tx, tz, 3)) tea.push({ position: [tx, Math.max(0, s.height - row * .7) + .5, tz], scale: [1.2, .65, 7.5], rotation: [0, Math.atan2(-s.tangent[0], -s.tangent[1]), 0], color: row % 2 ? "#577b4f" : "#759153" });
        }
      }
    }
    const railway = route.filter((p, i) => i % 3 === 0 && Math.abs(p.raceProgress - PARK_OBSTACLE_FRACTIONS[id]) < .023);
    for (const p of railway) for (const offset of [-3.05, -2.05]) {
      const [x, z] = pointAtTrackOffset(p, offset);
      boxes.push({ position: [x, p.height + .13, z], rotation: [0, Math.atan2(-p.tangent[0], -p.tangent[1]), p.bank], scale: [.07, .1, 3.1], color: "#a8ac9c", surface: "metal" });
    }
    const wave = sampleAtDistance(route, (COURSE_MECHANICS[id].from + .02) * length);
    const cloud = Array.from({ length: 28 }, (_, i) => ({ x: track.bounds.centerX + Math.cos(i * 2.4) * 145, z: track.bounds.centerZ + Math.sin(i * 2.4) * 130, y: 20 - i % 3 })).filter(p => clear(p.x, p.z, 26));
    return { architecture, boxes, lights, tea, wave, cloud };
  }, [track, id]);
  useFrame(({ clock }) => {
    const snapshot = snapshotsRef?.current.sampleFrame(clock.elapsedTime);
    const seconds = snapshot ? snapshot.tick / NETWORK_CONFIG.simulationRateHz : runtime.current.seconds || clock.elapsedTime;
    if (surf.current) { surf.current.position.y = Math.sin(seconds * Math.PI / 4) * .15; surf.current.visible = seconds % 8 < 5; }
    if (clouds.current) clouds.current.position.y = Math.sin(seconds * .12) * 1.2;
  });
  return <group name={`${id}-taiwan-environment`}>
    <TaiwanSky />{id === "taipei" && <TaipeiWorld />}{(id === "jiufen" || id === "kaohsiung") && <CoastalWorld id={id} />}<TaiwanArchitecture placements={props.architecture} /><TaiwanDistantBuildings placements={props.architecture} />
    {id !== "alishan" && <TaiwanCityDetails buildings={props.architecture} />}
    <TaiwanTerrain id={id} /><TaiwanRootSoil placements={props.architecture} /><TaiwanPlatforms /><TaiwanWindFlags /><TaiwanSpectacle />
    <TaiwanBoxes boxes={props.boxes} /><TaiwanBoxes boxes={props.lights} glow /><TaiwanBoxes boxes={props.tea} />
    {id === "alishan" && <AlishanWorld />}
    {(id === "jiufen" || id === "kaohsiung") && <group position={[props.wave.position[0], props.wave.height + .2, props.wave.position[1]]} rotation={[0, Math.atan2(-props.wave.tangent[0], -props.wave.tangent[1]), 0]}>
      <group ref={surf}>{[0, 1, 2].map(i => <mesh key={i} position={[-2.8, 0, i * 4]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[1.1, .06, 4, 16, Math.PI]} /><meshBasicMaterial color="#c0e4d6" /></mesh>)}</group>
    </group>}
    {id === "alishan" && <>
      <group ref={clouds} name="alishan-cloud-sea"><Instances limit={Math.max(1, props.cloud.length)}><sphereGeometry args={[1, 10, 6]} /><meshBasicMaterial color="#e7dece" />
        {props.cloud.map((p, i) => <Instance key={i} position={[p.x, p.y, p.z]} scale={[22, 2.5, 16]} />)}
      </Instances></group>
      <mesh position={[track.bounds.centerX, 90, track.bounds.centerZ + track.bounds.depth / 2 + 110]}><sphereGeometry args={[13, 16, 10]} /><meshBasicMaterial color="#ffe0a0" /></mesh>
    </>}
  </group>;
}
