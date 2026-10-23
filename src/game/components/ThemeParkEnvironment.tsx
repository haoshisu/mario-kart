import { isTaiwanTrack } from "../track/taiwanTracks";
import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, type Group } from "three";
import { useTrack } from "../track/TrackContext";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import { roadQuaternion, sampleTrackSurface, surfaceOffsetHeight } from "../track/trackSurface";
import { THEME_PARK_DISTRICTS, PARK_OBSTACLE_FRACTIONS } from "../track/themeParks";
import { routeLength, sampleAtDistance } from "../track/trackPlacement";
import { ExpansionLandmark, ExpansionScenery } from "./ExpansionScenery";
import { ParkDistrictDetails } from "./ParkDistrictDetails";

type Prop = { position: [number, number, number]; scale: [number, number, number]; color: string; rotation?: [number, number, number] };
const PALETTES = {
  forest: { terrain: "#2e7452", detail: "#b38451", glow: "#cafa91", water: "#399c96" },
  clockwork: { terrain: "#555c73", detail: "#c59150", glow: "#88f8e2", water: "#436b87" },
  volcano: { terrain: "#58424d", detail: "#a56850", glow: "#ffae66", water: "#f27136" },
  harbor: { terrain: "#40577b", detail: "#f0bc60", glow: "#6bfff0", water: "#247b9a" },
  canyon: { terrain: "#d89765", detail: "#e6c393", glow: "#ffe6a0", water: "#4fbab0" },
  aurora: { terrain: "#a8ccdf", detail: "#d9f5ff", glow: "#8affd1", water: "#559fc5" },
} as const;

function Batch({ props, shape = "box", glow = false }: { props: readonly Prop[]; shape?: "box" | "round" | "crystal"; glow?: boolean }) {
  return <Instances frames={1} limit={Math.max(1, props.length)} receiveShadow>
    {shape === "round" ? <sphereGeometry args={[1, 10, 6]} /> : shape === "crystal" ? <octahedronGeometry /> : <boxGeometry />}
    {glow ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial roughness={.8} />}
    {props.map((prop, i) => <Instance key={i} {...prop} />)}
  </Instances>;
}

function Landmark({ id, position }: { id: "harbor" | "canyon" | "aurora"; position: [number, number, number] }) {
  const motion = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (!motion.current) return;
    if (id === "harbor") motion.current.rotation.y = Math.sin(clock.elapsedTime * .22) * .25;
    else motion.current.rotation.z += Math.min(delta, .05) * (id === "canyon" ? .18 : .12);
  });
  if (id === "harbor") return <group position={position} name="harbor-tidelight-gantry">
    <Batch props={[-1, 1].flatMap(side => [
      { position: [side * 10, 17, 0], scale: [2, 34, 2], color: "#e5a553" },
      { position: [side * 10, 1, 0], scale: [7, 2, 8], color: "#405274" },
    ])} />
    <group ref={motion} position={[0, 34, 0]}>
      <Batch props={[
        { position: [0, 0, 0], scale: [32, 2, 3], color: "#e5a553" },
        { position: [11, -6, 0], scale: [.2, 12, .2], color: "#c5edee" },
        { position: [11, -13, 0], scale: [5, 3, 4], color: "#d779bd" },
      ]} />
      <Batch glow props={[{ position: [0, 1.1, 1.6], scale: [30, .3, .1], color: "#85ffe9" }]} />
    </group>
    <Batch props={[{ position: [0, -1, 0], scale: [22, 3, 18], color: "#345d7b" }]} shape="round" />
  </group>;
  if (id === "canyon") return <group position={position} name="canyon-sunwheel-arch">
    <Batch shape="round" props={[-1, 1].flatMap(side => [
      { position: [side * 12, 11, 0], scale: [5, 14, 8], color: "#bc7051" },
      { position: [side * 12, 20, 0], scale: [5.8, 4, 9], color: "#f0b77d" },
    ])} />
    <Batch shape="round" props={[{ position: [0, 25, 0], scale: [17, 5, 8], color: "#eaa374" },
      { position: [0, -2, 0], scale: [25, 5, 18], color: "#df9b68" }]} />
    <group ref={motion} position={[0, 25, -9]}>
      <mesh><torusGeometry args={[9, .6, 8, 32]} /><meshStandardMaterial color="#ffd88b" /></mesh>
      <Batch props={Array.from({ length: 8 }, (_, i) => ({ position: [Math.cos(i * Math.PI / 4) * 5, Math.sin(i * Math.PI / 4) * 5, 0],
        rotation: [0, 0, i * Math.PI / 4], scale: [10, .5, .4], color: "#eac580" }))} />
    </group>
  </group>;
  return <group position={position} name="aurora-crystal-observatory">
    <Batch shape="crystal" props={[{ position: [0, 16, 0], scale: [8, 23, 8], color: "#aedce9" },
      { position: [-10, 8, 0], scale: [4, 12, 4], color: "#b7b4eb" },
      { position: [10, 10, 0], scale: [4, 14, 4], color: "#a7dfcd" }]} />
    <group ref={motion} position={[0, 29, 0]}>
      <mesh><torusGeometry args={[10, .4, 8, 40]} /><meshBasicMaterial color="#9affdf" /></mesh>
      <Batch glow shape="crystal" props={Array.from({ length: 6 }, (_, i) => ({ position: [Math.cos(i * Math.PI / 3) * 10, Math.sin(i * Math.PI / 3) * 10, 0],
        scale: [1.1, 1.6, 1.1], color: "#ffe6b8" }))} />
    </group>
    <Batch shape="round" props={[{ position: [0, -2, 0], scale: [21, 5, 18], color: "#bedce7" }]} />
  </group>;
}

function AmbientParticles({ snow }: { snow: boolean }) {
  const track = useTrack();
  const geometry = useMemo(() => {
    const data = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      data[i * 3] = track.bounds.centerX + Math.sin(i * 17.1) * track.bounds.width * .55;
      data[i * 3 + 1] = 4 + i % 24;
      data[i * 3 + 2] = track.bounds.centerZ + Math.cos(i * 13.7) * track.bounds.depth * .55;
    }
    return new BufferGeometry().setAttribute("position", new BufferAttribute(data, 3));
  }, [track]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    const positions = geometry.getAttribute("position");
    const dt = Math.min(delta, .05);
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i) + dt * (snow ? -.9 : .35);
      positions.setY(i, y < 1 ? 28 : y > 28 ? 1 : y);
    }
    positions.needsUpdate = true;
  });
  return <points geometry={geometry} frustumCulled={false}>
    <pointsMaterial size={snow ? .16 : .09} color={snow ? "#f0fbff" : "#ffedc3"} transparent opacity={.55} depthWrite={false} />
  </points>;
}

/** Original three-layer park scenery. Decorative footprints clear every road;
 * animated collision props remain in the shared authority/physics integration.
 */
export function ThemeParkEnvironment() {
  const track = useTrack();
  const id = track.id === "tainan" || track.id === "taichung" || track.id === "meadow" || isTaiwanTrack(track.id) ? "harbor" : track.id;
  const palette = PALETTES[id];
  const ripple = useRef<Group>(null), flags = useRef<Group>(null);
  const props = useMemo(() => {
    const roads = [{ samples: track.samples, width: 8.4 }, ...track.branches];
    const clear = (x: number, z: number, radius: number) => roads.every(road => distanceToTrack(x, z, road.samples, { closed: road.samples === track.samples }) > road.width / 2 + radius + .6);
    const terrain: Prop[] = [], details: Prop[] = [], glow: Prop[] = [], water: Prop[] = [], ripples: Prop[] = [], pennants: Prop[] = [];
    const sections = THEME_PARK_DISTRICTS[id];
    const route = track.race.RACE_ROUTE_SAMPLES;
    route.forEach((sample, index) => {
      const district = sections.find(section => sample.raceProgress < section.to) ?? sections[sections.length - 1];
      const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
      const sprint = sample.raceProgress < .14 || sample.raceProgress > .88;
      const tracksideSpacing = sprint ? 12 : 22;
      const midgroundSpacing = sprint ? 48 : 30;
      if (index % tracksideSpacing === 0) for (const side of [-1, 1]) {
        const [x, z] = pointAtTrackOffset(sample, side * 6.8);
        if (!clear(x, z, .8)) continue;
        const y = surfaceOffsetHeight(sample, side * 6.8);
        details.push({ position: [x, y + 1.5, z], scale: [.18, 3, .18], color: palette.detail });
        glow.push({ position: [x, y + 3.1, z], scale: [.4, .25, .4], color: district.color });
        pennants.push({ position: [x, y + 2.5, z], scale: [.8, .5, .06], rotation: [0, yaw, 0], color: district.color });
      }
      if (index % midgroundSpacing !== 0) return;
      for (const side of [-1, 1]) {
        const [x, z] = pointAtTrackOffset(sample, side * 19);
        if (!clear(x, z, 10)) continue;
        const bridgeVista = id === "harbor" && sample.height > 5;
        terrain.push({ position: [x, bridgeVista ? -3 : Math.max(-2, sample.height - 7), z],
          scale: [10, bridgeVista ? 3 : 8 + sample.height * .35, 10], color: palette.terrain });
        if (id === "harbor" || sample.raceProgress >= .4 && sample.raceProgress < .56) {
          water.push({ position: [x, -.12, z], scale: [13, .16, 13], color: palette.water });
          ripples.push({ position: [x, 0, z], scale: [8, .03, .12], rotation: [0, yaw, 0], color: "#a5eee9" });
        }
      }
    });
    const warning = sampleAtDistance(route, (PARK_OBSTACLE_FRACTIONS[id] - .06) * routeLength(route));
    for (const side of [-1, 1]) {
      const [x, z] = pointAtTrackOffset(warning, side * 6.8);
      if (!clear(x, z, 1)) continue;
      const yaw = Math.atan2(-warning.tangent[0], -warning.tangent[1]);
      details.push({ position: [x, warning.height + 1.25, z], scale: [.15, 2.5, .15], color: palette.detail },
        { position: [x, warning.height + 2.5, z], scale: [2.1, 1.3, .18], rotation: [0, yaw, 0], color: "#ffcb65" });
      glow.push({ position: [x, warning.height + 2.5, z], scale: [.22, .8, .22], color: "#273e52" });
    }
    let landmark: [number, number, number] | undefined;
    for (let ring = 0; ring <= 150 && !landmark; ring += 5) for (let direction = 0; direction < 16; direction++) {
      const x = track.bounds.centerX + Math.cos(direction * Math.PI / 8) * ring;
      const z = track.bounds.centerZ + Math.sin(direction * Math.PI / 8) * ring;
      if (clear(x, z, 25)) { landmark = [x, 0, z]; break; }
    }
    if (!landmark) throw new Error(`${id}: no safe landmark anchor`);
    const mountains = Array.from({ length: 16 }, (_, i): Prop => ({
      position: [track.bounds.centerX + Math.cos(i * Math.PI / 8) * (track.bounds.width / 2 + 65), -4,
        track.bounds.centerZ + Math.sin(i * Math.PI / 8) * (track.bounds.depth / 2 + 65)],
      scale: [28, 22 + i % 4 * 6, 28], color: palette.terrain,
    })).filter(prop => clear(prop.position[0], prop.position[2], 28));
    const tunnel = (id === "harbor" ? route.filter(sample => sample.raceProgress > .465 && sample.raceProgress < .545)
      : track.branches[0].samples.filter(sample => sample.progress > .2 && sample.progress < .8)).filter((_, i) => i % 5 === 0).flatMap(sample => {
      const sideOffset = id === "harbor" ? 6.8 : 4.8;
      // A rock overhang may cover adjacent road ribbons. Its pillars must
      // still clear both; omit the wall on the side facing a nearby main road.
      const sides = [-1, 1].filter(side => { const [x, z] = pointAtTrackOffset(sample, side * sideOffset); return clear(x, z, .6); });
      if (!sides.length) return [];
      const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
      const quaternion = roadQuaternion(yaw, sampleTrackSurface(...sample.position, id === "harbor" ? route : track.branches[0].samples, undefined,
        { height: sample.height, closed: id === "harbor" }));
      return [{ sample, sideOffset, quaternion, sides }];
    });
    return { terrain, details, glow, water, ripples, pennants, landmark, mountains, tunnel };
  }, [track, id, palette]);
  useFrame(({ clock }) => {
    if (ripple.current) ripple.current.position.y = Math.sin(clock.elapsedTime * 1.4) * .035;
    if (flags.current) flags.current.rotation.x = Math.sin(clock.elapsedTime * 2) * .0015;
  });
  return <group name={`${id}-theme-park-environment`}>
    <ParkDistrictDetails />
    <Batch props={props.details} /><Batch props={props.glow} glow />
    <group ref={flags}><Batch props={props.pennants} /></group>
    <Batch props={props.terrain} shape={id === "aurora" ? "crystal" : "round"} />
    <Batch props={props.mountains} shape={id === "aurora" ? "crystal" : "round"} />
    <Batch props={props.water} /><group ref={ripple}><Batch props={props.ripples} glow /></group>
    {id === "forest" || id === "clockwork" || id === "volcano" ? <><ExpansionLandmark id={id} position={props.landmark} /><ExpansionScenery /></> : <Landmark id={id} position={props.landmark} />}<AmbientParticles snow={id === "aurora"} />
    <Instances frames={1} limit={props.tunnel.length * 4} receiveShadow>
      <boxGeometry /><meshStandardMaterial roughness={.8} />
      {props.tunnel.map(({ sample, sideOffset, quaternion, sides }, i) => <group key={i}
        position={[sample.position[0], sample.height, sample.position[1]]} quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}>
        {sides.map(side => <Instance key={side} position={[side * sideOffset, 3, 0]} scale={[.8, 6, 5.4]} color={palette.terrain} />)}
        <Instance position={[0, 6.5, 0]} scale={[sideOffset * 2 + .8, .8, 5.4]} color={id === "harbor" ? "#172b48" : palette.terrain} />
        <Instance position={[0, 5.95, 0]} scale={[sideOffset * 1.6, .12, .14]} color={palette.glow} />
      </group>)}
    </Instances>
  </group>;
}
