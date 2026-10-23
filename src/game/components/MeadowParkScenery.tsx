import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group } from "three";
import { useTrack } from "../track/TrackContext";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import type { TrackSample } from "../track/trackPath";
import type { RaceRouteSample } from "../core/race/raceTrack";
import { MEADOW_PARK_LANDMARKS, MEADOW_PARK_SECTIONS, MEADOW_PARK_OBSTACLE } from "../track/meadowPark";
import { sampleAtDistance, routeLength } from "../track/trackPlacement";
import { surfaceOffsetHeight } from "../track/trackSurface";
import { ParkDistrictDetails } from "./ParkDistrictDetails";

type Prop = { position: [number, number, number]; scale: [number, number, number];
  rotation?: [number, number, number]; color: string };
const FLOWER_COLORS = ["#ff91bc", "#ffd451", "#be9bec", "#fff2c6"];

function Batch({ props, round = false, glow = false, glass = false }: { props: readonly Prop[]; round?: boolean; glow?: boolean; glass?: boolean }) {
  return <Instances frames={1} limit={Math.max(1, props.length)} receiveShadow>
    {round ? <sphereGeometry args={[1, 8, 5]} /> : <boxGeometry />}
    {glow ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial roughness={glass ? .25 : .87}
      transparent={glass} opacity={glass ? .32 : 1} depthWrite={!glass} />}
    {props.map((prop, index) => <Instance key={index} {...prop} />)}
  </Instances>;
}

/** Park architecture is continuous along the road, rather than a scatter of
 * unrelated props. All solid scenery clears every driveable ribbon in XZ.
 */
function createParkProps(samples: readonly TrackSample[], roads: readonly (readonly TrackSample[])[]) {
  const boxes: Prop[] = [], rounds: Prop[] = [], lights: Prop[] = [], flags: Prop[] = [], trees: Prop[] = [];
  const clear = (x: number, z: number, radius: number) => roads.every(road => distanceToTrack(x, z, road) > 5.2 + radius);
  samples.forEach((sample, index) => {
    const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
    if (index % 5 === 0) for (const side of [-1, 1]) {
      const [x, z] = pointAtTrackOffset(sample, side * 6.7);
      if (![-2.6, 0, 2.6].every(along => clear(x + sample.tangent[0] * along, z + sample.tangent[1] * along, .65))) continue;
      const y = surfaceOffsetHeight(sample, side * 6.7);
      boxes.push({ position: [x, y + .45, z], scale: [.75, .9, 5.2], rotation: [0, yaw, 0], color: "#f4dcb0" });
      rounds.push({ position: [x, y + .95, z], scale: [.85, .45, 2.8], rotation: [0, yaw, 0], color: index % 3 ? "#41965e" : "#689c53" });
      for (let petal = -1; petal <= 1; petal++) rounds.push({ position: [x + sample.tangent[0] * petal * 1.4, y + 1.28, z + sample.tangent[1] * petal * 1.4],
        scale: [.36, .22, .36], color: FLOWER_COLORS[Math.floor(index / 5) % 4] });
      if (index % 20 === 0) {
        boxes.push({ position: [x, y + 2.25, z], scale: [.13, 4.5, .13], color: "#295b58" });
        lights.push({ position: [x, y + 4.3, z], scale: [.3, .4, .3], color: "#fff3ab" });
        flags.push({ position: [x, y + 3.5, z], scale: [.85, .55, .05], rotation: [0, yaw, 0], color: FLOWER_COLORS[Math.floor(index / 20) % 4] });
      }
    }
    if (index % 12 !== 0) return;
    for (const side of [-1, 1]) {
      const [x, z] = pointAtTrackOffset(sample, side * 18);
      if (!clear(x, z, 10)) continue;
      // Overlapping rounded retaining hills connect gardens to elevated road.
      const openBridgeVista = sample.progress >= .16 && sample.progress <= .33;
      rounds.push({ position: [x, openBridgeVista ? -2 : Math.max(0, sample.height - 4), z],
        scale: [10, openBridgeVista ? 6 : 6 + sample.height * .25, 10], color: index % 24 ? "#74b862" : "#91c577" });
      if (index % 36 === 0) {
        boxes.push({ position: [x, 3, z], scale: [7, 6, 8], rotation: [0, yaw, 0], color: "#ffe0a9" });
        boxes.push({ position: [x, 6.35, z], scale: [8, .7, 9], rotation: [0, yaw, 0], color: "#d56d80" });
        boxes.push({ position: [x + sample.normal[0] * 3.6, 3.2, z + sample.normal[1] * 3.6], scale: [.15, 2.2, 4], rotation: [0, yaw, 0], color: "#548793" });
      } else {
        trees.push({ position: [x, 6 + sample.height * .2, z], scale: [2.2, 3.5, 2.2], color: "#397e61" });
      }
    }
  });
  return { boxes, rounds, lights, flags, trees, clear };
}

function AnimatedFlags({ props, round = false }: { props: readonly Prop[]; round?: boolean }) {
  const flags = useRef<Array<Group | null>>([]);
  useFrame(({ clock }) => {
    for (let i = 0; i < flags.current.length; i++) {
      const flag = flags.current[i];
      if (flag) flag.rotation.x = Math.sin(clock.elapsedTime * 2.4 + i * .5) * .18;
    }
  });
  return <Instances limit={Math.max(1, props.length)}>
    {round ? <sphereGeometry args={[1, 8, 5]} /> : <boxGeometry />}<meshStandardMaterial roughness={.75} />
    {props.map((prop, i) => <Instance key={i} ref={value => { flags.current[i] = value instanceof Group ? value : null; }} {...prop} />)}
  </Instances>;
}

function GiantWindmill({ position }: { position: [number, number, number] }) {
  const rotor = useRef<Group>(null);
  useFrame((_, delta) => { if (rotor.current) rotor.current.rotation.z += Math.min(delta, .05) * .19; });
  return <group position={position} name="meadow-giant-windmill">
    <mesh position={[0, 11, 0]} receiveShadow><cylinderGeometry args={[3.4, 6, 22, 12]} /><meshStandardMaterial color="#ffedc6" /></mesh>
    <mesh position={[0, 24, 0]}><coneGeometry args={[5.2, 7, 12]} /><meshStandardMaterial color="#bd687a" /></mesh>
    <mesh position={[0, 10, -5.6]}><boxGeometry args={[2.5, 8, .25]} /><meshStandardMaterial color="#336b75" /></mesh>
    <group ref={rotor} position={[0, 20, -4]}>
      <Instances frames={1} limit={8}>
        <boxGeometry /><meshStandardMaterial roughness={.8} />
        {[0, 1, 2, 3].map(i => <group key={i} rotation={[0, 0, i * Math.PI / 2]}>
          <Instance position={[0, 7, 0]} scale={[.5, 15, .5]} color="#886348" />
          <Instance position={[1.1, 9, 0]} scale={[2.8, 9, .3]} color={i % 2 ? "#ffe58c" : "#ffc0d6"} />
        </group>)}
      </Instances>
      <mesh><sphereGeometry args={[1.2, 12, 8]} /><meshStandardMaterial color="#fff7d2" /></mesh>
    </group>
  </group>;
}

function FlowerWheel({ position }: { position: [number, number, number] }) {
  const wheel = useRef<Group>(null);
  useFrame((_, delta) => { if (wheel.current) wheel.current.rotation.z += Math.min(delta, .05) * .11; });
  return <group position={position} name="meadow-flower-wheel">
    <Batch props={[-1, 1].map(side => ({ position: [side * 4, 6, 0], scale: [.7, 13, .8], rotation: [0, 0, side * .35], color: "#f0d5a3" }))} />
    <group ref={wheel} position={[0, 13, 0]}>
      <mesh><torusGeometry args={[10, .35, 6, 32]} /><meshStandardMaterial color="#ee9bac" /></mesh>
      <Instances frames={1} limit={16}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial />
        {Array.from({ length: 8 }, (_, i) => { const angle = i * Math.PI / 4; return <group key={i}>
          <Instance position={[Math.cos(angle) * 10, Math.sin(angle) * 10, 0]} scale={[2.2, 1.6, 1.5]} color={FLOWER_COLORS[i % 4]} />
          <Instance position={[Math.cos(angle) * 10, Math.sin(angle) * 10, -1.3]} scale={[.6, .6, .3]} color="#fff5c8" />
        </group>; })}
      </Instances>
      <Instances frames={1} limit={8}><boxGeometry /><meshStandardMaterial color="#faf1c6" />
        {Array.from({ length: 8 }, (_, i) => <Instance key={i} rotation={[0, 0, i * Math.PI / 4]} position={[Math.cos(i * Math.PI / 4) * 5, Math.sin(i * Math.PI / 4) * 5, 0]} scale={[10, .15, .15]} />)}
      </Instances>
    </group>
  </group>;
}

function GardenFlowerGates({ samples }: { samples: readonly RaceRouteSample[] }) {
  const gates = useMemo(() => [.39, .45].map(fraction => sampleAtDistance(samples, fraction * routeLength(samples))), [samples]);
  return <group name="meadow-garden-flower-gates">
    {gates.map((gate, index) => <group key={index} position={[gate.position[0], gate.height, gate.position[1]]}
      rotation={[0, Math.atan2(-gate.tangent[0], -gate.tangent[1]), 0]}>
      <mesh position={[0, 1, 0]}><torusGeometry args={[7.2, .25, 6, 24, Math.PI]} />
        <meshStandardMaterial color="#e9d9af" /></mesh>
      <Instances frames={1} limit={11}><sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial roughness={.8} />
        {Array.from({ length: 11 }, (_, i) => <Instance key={i}
          position={[Math.cos(i * Math.PI / 10) * 7.2, 1 + Math.sin(i * Math.PI / 10) * 7.2, 0]}
          scale={[.8, .8, .5]} color={FLOWER_COLORS[(i + index) % FLOWER_COLORS.length]} />)}
      </Instances>
      <Batch props={[-1, 1].map(side => ({ position: [side * 7.2, .5, 0], scale: [.6, 1, .6], color: "#e9d9af" }))} />
    </group>)}
  </group>;
}

function ParkResidents({ samples, roads }: { samples: readonly TrackSample[]; roads: readonly (readonly TrackSample[])[] }) {
  const group = useRef<Group>(null);
  const props = useMemo(() => samples.filter((_, i) => i % 45 === 0).flatMap((sample, i) => {
    const [x, z] = pointAtTrackOffset(sample, (i % 2 ? 1 : -1) * 8.4);
    if (roads.some(road => distanceToTrack(x, z, road) < 7.5)) return [];
    return [{ position: [x, sample.height + 1, z] as [number, number, number], scale: [.7, .9, .7] as [number, number, number], color: FLOWER_COLORS[i % 4] }];
  }), [samples, roads]);
  useFrame(({ clock }) => { if (group.current) group.current.position.y = Math.sin(clock.elapsedTime * 2) * .08; });
  return <group ref={group} name="meadow-flower-residents">
    <Batch props={props} round />
    <Batch props={props.flatMap(prop => [-1, 1].map(side => ({ position: [prop.position[0] + side * .22, prop.position[1] + .23, prop.position[2] - .6] as [number, number, number], scale: [.1, .13, .12] as [number, number, number], color: "#203f48" })))} round />
  </group>;
}

function Greenhouse({ samples, roads }: { samples: readonly TrackSample[]; roads: readonly (readonly TrackSample[])[] }) {
  const props = useMemo(() => {
    const shell: Prop[] = [], lights: Prop[] = [], shade: Prop[] = [];
    samples.forEach((sample, index) => {
      if (index % 5) return;
      const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
      if ([-1, 1].some(side => {
        const [x, z] = pointAtTrackOffset(sample, side * 6.8);
        return roads.some(road => distanceToTrack(x, z, road) < 5.8);
      })) return;
      for (const side of [-1, 1]) {
        const [x, z] = pointAtTrackOffset(sample, side * 6.8);
        shell.push({ position: [x, sample.height + 2.5, z], scale: [.35, 5, 5.5], rotation: [0, yaw, 0], color: "#245555" });
        shell.push({ position: [x, sample.height + 2.3, z], scale: [.45, .16, 5.6], rotation: [0, yaw, 0], color: "#b9ca84" });
        lights.push({ position: [x - sample.normal[0] * side * .3, sample.height + 3.8, z], scale: [.22, .45, .22], color: "#d4ffb2" });
      }
      shell.push({ position: [sample.position[0], sample.height + 5.1, sample.position[1]], scale: [14, .4, 5.5], rotation: [0, yaw, 0], color: "#1a414a" });
      shell.push({ position: [sample.position[0], sample.height + 5.55, sample.position[1]], scale: [5, .5, 5.5], rotation: [0, yaw, 0], color: "#669d83" });
      // Opaque shade sails make the open sky -> luminous interior transition
      // readable while retaining the glass sides and a clear driving corridor.
      shade.push({ position: [sample.position[0], sample.height + 6.1, sample.position[1]], scale: [13.5, .18, 5.5], rotation: [0, yaw, 0], color: "#173f49" });
      lights.push({ position: [sample.position[0], sample.height + 4.84, sample.position[1]], scale: [9, .09, .16], rotation: [0, yaw, 0], color: "#d0ffbd" });
    });
    return { shell, lights, shade };
  }, [samples, roads]);
  const motes = useRef<Group>(null);
  useFrame(({ clock }) => { if (motes.current) motes.current.position.y = Math.sin(clock.elapsedTime * .8) * .18; });
  return <group name="meadow-luminous-greenhouse">
    <Batch props={props.shell} glass /><Batch props={props.shade} /><Batch props={props.lights} glow />
    <group ref={motes}><Batch round glow props={samples.filter((_, i) => i % 3 === 0).map((sample, i) => ({
      position: [sample.position[0] + sample.normal[0] * (i % 2 ? 4.8 : -4.8), sample.height + 2 + i % 3 * .7, sample.position[1] + sample.normal[1] * (i % 2 ? 4.8 : -4.8)],
      scale: [.05, .05, .05], color: "#e0ffc5",
    }))} /></group>
  </group>;
}

function Creekside({ samples, roads }: { samples: readonly TrackSample[]; roads: readonly (readonly TrackSample[])[] }) {
  const ripple = useRef<Group>(null);
  const props = useMemo(() => {
    const water: Prop[] = [], banks: Prop[] = [], ripples: Prop[] = [];
    samples.forEach((sample, index) => {
      if (index % 4) return;
      const [x, z] = pointAtTrackOffset(sample, -12);
      if (roads.some(road => distanceToTrack(x, z, road) < 9.2)) return;
      const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
      water.push({ position: [x, sample.height - .85, z], scale: [7.5, .15, 4.5], rotation: [0, yaw, 0], color: "#399dba" });
      ripples.push({ position: [x, sample.height - .72, z], scale: [3.2, .035, .15], rotation: [0, yaw, 0], color: "#8ddcd9" });
      banks.push({ position: [x - sample.normal[0] * 4, sample.height - .3, z - sample.normal[1] * 4], scale: [1.2, 1.2, 2.8], rotation: [0, yaw, 0], color: "#b5ce8b" });
    });
    return { water, banks, ripples };
  }, [samples, roads]);
  useFrame(({ clock }) => { if (ripple.current) ripple.current.position.y = Math.sin(clock.elapsedTime * 1.2) * .025; });
  return <group name="meadow-creekside-water"><Batch props={props.water} /><Batch props={props.banks} round />
    <group ref={ripple}><Batch props={props.ripples} glow /></group>
  </group>;
}

function WaterfallCliffs({ position }: { position: [number, number, number] }) {
  const water = useRef<Group>(null);
  useFrame(({ clock }) => { if (water.current) water.current.scale.x = 1 + Math.sin(clock.elapsedTime * 2) * .025; });
  return <group position={position} name="meadow-waterfall-cliffs">
    <Batch props={Array.from({ length: 9 }, (_, i) => ({ position: [(i - 4) * 3, 5 + i % 3, 0], scale: [3.5, 10 + i % 3 * 2, 5], color: i % 2 ? "#a3a981" : "#839b73" }))} round />
    <Batch props={Array.from({ length: 9 }, (_, i) => ({ position: [(i - 4) * 3, 13 + i % 3, 0], scale: [3.5, 2, 5], color: "#6bab70" }))} round />
    <group ref={water}><Batch props={[-1, 0, 1].map(side => ({ position: [side * 1.7, 7, -7], scale: [1.8, 14, .4], color: side ? "#b5eae4" : "#e0faf0" }))} glow /></group>
    <Batch props={[{ position: [0, -.25, -13], scale: [15, .3, 15], color: "#469eb1" }]} />
  </group>;
}

export function MeadowParkScenery() {
  const track = useTrack();
  const roads = useMemo(() => [track.samples, ...track.branches.map(branch => branch.samples)], [track]);
  const props = useMemo(() => createParkProps(track.samples, roads), [track, roads]);
  const landmarks = useMemo(() => {
    function safeAnchor(anchor: readonly [number, number, number], radius: number, avoid?: readonly [number, number, number]): [number, number, number] {
      for (let ring = 0; ring <= 100; ring += 5) for (let direction = 0; direction < 16; direction++) {
        const x = anchor[0] + Math.cos(direction * Math.PI / 8) * ring;
        const z = anchor[2] + Math.sin(direction * Math.PI / 8) * ring;
        if (props.clear(x, z, radius) && (!avoid || Math.hypot(x - avoid[0], z - avoid[2]) > radius + 16)) return [x, anchor[1], z];
      }
      throw new Error("Meadow park landmark has no clear scenery anchor");
    }
    const windmill = safeAnchor(MEADOW_PARK_LANDMARKS.windmill.position, 17);
    return { windmill, wheel: safeAnchor(MEADOW_PARK_LANDMARKS.flowerWheel.position, 12),
      waterfall: safeAnchor(MEADOW_PARK_LANDMARKS.waterfall.position, 21, windmill) };
  }, [props]);
  const districtSamples = (id: typeof MEADOW_PARK_SECTIONS[number]["id"]) => {
    const section = MEADOW_PARK_SECTIONS.find(section => section.id === id);
    return section ? track.race.RACE_ROUTE_SAMPLES.filter(sample => sample.raceProgress >= section.from && sample.raceProgress <= section.to) : [];
  };
  const warning = sampleAtDistance(track.race.RACE_ROUTE_SAMPLES, (MEADOW_PARK_OBSTACLE.fraction - .065) * routeLength(track.race.RACE_ROUTE_SAMPLES));
  const warningSigns: Prop[] = [-1, 1].flatMap(side => {
    const [x, z] = pointAtTrackOffset(warning, side * 7);
    if (!props.clear(x, z, 1)) return [];
    const yaw = Math.atan2(-warning.tangent[0], -warning.tangent[1]);
    return [{ position: [x, warning.height + 1.1, z], scale: [.12, 2.2, .12], color: "#526c4b" },
      { position: [x, warning.height + 2.1, z], scale: [1.8, 1.1, .12], rotation: [0, yaw, 0], color: "#ffce59" },
      { position: [x, warning.height + 2.1, z - .12], scale: [.2, .7, .14], rotation: [0, yaw, 0], color: "#294953" }];
  });
  const skyline: Prop[] = Array.from({ length: 20 }, (_, i) => {
    const angle = i * Math.PI / 10;
    return { position: [track.bounds.centerX + Math.cos(angle) * (track.bounds.width / 2 + 60), -5, track.bounds.centerZ + Math.sin(angle) * (track.bounds.depth / 2 + 60)] as [number, number, number],
      scale: [28, 18 + i % 3 * 6, 28] as [number, number, number], color: i % 2 ? "#83b699" : "#98c6a7" };
  }).filter(prop => props.clear(prop.position[0], prop.position[2], 28));
  return <group name="meadow-theme-park">
    <ParkDistrictDetails />
    <Batch props={props.boxes} />
    <Batch props={props.rounds.filter(prop => prop.scale[0] < 4 || Math.hypot(prop.position[0] - landmarks.windmill[0], prop.position[2] - landmarks.windmill[2]) > 18)} round />
    <Batch props={props.lights} round glow />
    <AnimatedFlags props={props.flags} /><AnimatedFlags props={props.trees} round />
    <ParkResidents samples={track.samples} roads={roads} />
    <GiantWindmill position={landmarks.windmill} />
    <FlowerWheel position={landmarks.wheel} />
    <GardenFlowerGates samples={track.race.RACE_ROUTE_SAMPLES} />
    <Greenhouse roads={roads} samples={districtSamples("greenhouse")} />
    <Creekside roads={roads} samples={districtSamples("valley")} />
    <WaterfallCliffs position={landmarks.waterfall} />
    <Batch props={warningSigns} /><Batch props={skyline} round />
  </group>;
}
