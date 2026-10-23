import { surfaceTexture } from "../rendering/surfaceTextures";
import { isTaiwanTrack } from "../track/taiwanTracks";
import { TAIWAN_DISTRICTS } from "../track/taiwanDesign";
import { TaiwanLandmark } from "./TaiwanProps";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { SnapshotBuffer } from "../network/interpolation";
import { NETWORK_CONFIG } from "../network/networkConfig";
import { useTrackRuntimeRef } from "../track/TrackContext";
import { CourseFeatures } from "./CourseFeatures";
import { TrackSupports } from "./TrackSupports";
import { Instance, Instances } from "@react-three/drei";
import { useMemo, useRef, type RefObject } from "react";
import { BufferGeometry, Float32BufferAttribute, Color } from "three";
import type { TrackMeshData, createTrackGeometry } from "../track/trackGeometry";
import { MEADOW_PARK_SECTIONS } from "../track/meadowPark";
import { TRACK_CONFIG } from "../track/trackConfig";
import { TaipeiCrossing } from "./TaipeiCrossing";
import { useTrack } from "../track/TrackContext";

function createBufferGeometry(data: TrackMeshData) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(data.vertices, 3));
  geometry.setIndex(Array.from(data.indices));
  const uv = new Float32Array(data.vertices.length / 3 * 2);
  for (let i = 0; i < data.vertices.length / 3; i++) { uv[i * 2] = data.vertices[i * 3] / 2; uv[i * 2 + 1] = data.vertices[i * 3 + 2] / 2; }
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

type Geometry = ReturnType<typeof createTrackGeometry>;
function RoadSurface({ data, color }: { data: Geometry; color?: string }) {
  const { ROAD_MESH_DATA, ROAD_EDGE_MESH_DATA } = data;
  const track = useTrack();
  const districtColors = (track.id === "meadow" || isTaiwanTrack(track.id)) && color === undefined;
  const geometry = useMemo(() => {
    const mesh = createBufferGeometry(ROAD_MESH_DATA);
    if (districtColors) {
      const sections = isTaiwanTrack(track.id) ? TAIWAN_DISTRICTS[track.id] : MEADOW_PARK_SECTIONS;
      const palette = (isTaiwanTrack(track.id) ? TAIWAN_DISTRICTS[track.id].map(section=>new Color("#454b50").lerp(new Color(section.color),.065))
        : ["#719dac", "#cbbb92", "#88aca2", "#417987", "#73a8b7", "#cba8a0"].map(value => new Color("#454b50").lerp(new Color(value), .065)));
      const colors = new Float32Array(ROAD_MESH_DATA.vertices.length);
      track.samples.forEach((sample, i) => {
        const progress=sample.courseProgress??sample.progress;
        const district = sections.findIndex(section => progress >= section.from && progress < section.to);
        const tint = palette[Math.max(0, district)];
        for (let vertex = 0; vertex < 4; vertex++) tint.toArray(colors, i * 12 + vertex * 3);
      });
      mesh.setAttribute("color", new Float32BufferAttribute(colors, 3));
    }
    return mesh;
  }, [ROAD_MESH_DATA, districtColors, track]);

  const edges = useMemo(() => createBufferGeometry(ROAD_EDGE_MESH_DATA), [ROAD_EDGE_MESH_DATA]);
  return (
    <group>
    <mesh geometry={edges} receiveShadow><meshStandardMaterial color="#89908d" map={surfaceTexture("concrete")} roughness={.94} /></mesh>
    <mesh geometry={geometry} receiveShadow>
      {/* Shared merge decks need a depth bias to avoid coplanar flicker. */}
      <meshStandardMaterial vertexColors={districtColors} color={track.id === "tainan" ? "#c5a580" : districtColors ? "#ffffff" : color ?? "#454b50"}
        polygonOffset={color !== undefined} polygonOffsetFactor={-2} polygonOffsetUnits={-2} map={surfaceTexture(track.id === "tainan" ? "brick" : "asphalt")} bumpMap={surfaceTexture(track.id === "tainan" ? "brick" : "asphalt")} bumpScale={.025} metalness={0.02} roughness={0.92} />
    </mesh>
    </group>
  );
}

function Curbs({ data }: { data: Geometry }) {
  const { RED_CURB_MESH_DATA, WHITE_CURB_MESH_DATA } = data;
  const { colors: TRACK_COLORS } = useTrack();
  const redGeometry = useMemo(() => createBufferGeometry(RED_CURB_MESH_DATA), [RED_CURB_MESH_DATA]);
  const whiteGeometry = useMemo(() => createBufferGeometry(WHITE_CURB_MESH_DATA), [WHITE_CURB_MESH_DATA]);

  return (
    <>
      <mesh geometry={redGeometry} receiveShadow>
        <meshStandardMaterial color={TRACK_COLORS.curbRed} flatShading roughness={0.78} />
      </mesh>
      <mesh geometry={whiteGeometry} receiveShadow>
        <meshStandardMaterial color={TRACK_COLORS.curbWhite} flatShading roughness={0.86} />
      </mesh>
    </>
  );
}

function GuardRailInstances({ stripe, data }: { stripe: "red" | "white"; data: Geometry }) {
  const { GUARD_RAIL_SEGMENTS } = data;
  const track = useTrack(), TRACK_COLORS = track.colors;
  const segments = GUARD_RAIL_SEGMENTS.filter((segment) => segment.stripe === stripe);

  return (
    <Instances castShadow frames={1} limit={segments.length} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={isTaiwanTrack(track.id) ? stripe === "red" ? "#919c9b" : "#b8c0be" : stripe === "red" ? TRACK_COLORS.railRed : TRACK_COLORS.railWhite}
        metalness={0.18}
        roughness={0.58}
      />
      {segments.map((segment, index) => (
        <Instance
          key={`${stripe}-${index}`}
          position={segment.position}
          rotation={[0, segment.rotationY, segment.rotationZ]}
          scale={segment.size}
        />
      ))}
    </Instances>
  );
}

function GuardRails({ data }: { data: Geometry }) {
  return (
    <>
      <GuardRailInstances stripe="red" data={data} />
      <GuardRailInstances stripe="white" data={data} />
    </>
  );
}

function StartGrid() {
  const { race: { FINISH_MARKER } } = useTrack();
  const columns = 8;
  const rows = 2;
  const tileWidth = TRACK_CONFIG.roadWidth / columns;
  const tileLength = 0.48;

  return (
    <Instances frames={1} limit={columns * rows} receiveShadow>
      <planeGeometry args={[tileLength, tileWidth]} />
      <meshStandardMaterial roughness={.88} />
      {Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const isLight = (column + row) % 2 === 0;
        const forwardOffset = (row - (rows - 1) / 2) * tileLength;
        const lateralOffset = (column - (columns - 1) / 2) * tileWidth;

        return (
          <Instance
            key={index}
            position={[
              FINISH_MARKER.position[0] +
                FINISH_MARKER.forward[0] * forwardOffset +
                FINISH_MARKER.right[0] * lateralOffset,
              TRACK_CONFIG.roadTop + 0.012,
              FINISH_MARKER.position[1] +
                FINISH_MARKER.forward[1] * forwardOffset +
                FINISH_MARKER.right[1] * lateralOffset,
            ]}
            color={isLight ? "#f6f0df" : "#1b1e20"}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        );
      })}
    </Instances>
  );
}

function BridgeSurface() {
  const track = useTrack(), runtimeRef = useTrackRuntimeRef(), deck=useRef<Group>(null), gates=useRef<(Group|null)[]>([]);
  useFrame(()=>{
    const state=runtimeRef.current.bridge;
    if(deck.current) deck.current.rotation.y=state?.angle??0;
    gates.current.forEach(gate=>{if(gate) gate.position.y=state?.gateHeight??-4;});
  });
  const bridge=track.bridge;
  if(!bridge) return null;
  const part=(index:number)=><><RoadSurface data={bridge.geometries[index]} color="#bac4ad" /><Curbs data={bridge.geometries[index]} /><GuardRails data={bridge.geometries[index]} /></>;
  return <group name="kaohsiung-rotating-race-bridge">
    {part(0)}{part(2)}
    <group ref={deck} position={[...bridge.pivot]}><group position={[-bridge.pivot[0],0,-bridge.pivot[2]]}>{part(1)}<group position={[bridge.pivot[0],bridge.branch.samples[Math.floor(bridge.branch.samples.length/2)].height,bridge.pivot[2]+9]}><TaiwanLandmark id="kaohsiung" /></group></group></group>
    {bridge.gates.map((gate,i)=><group key={i} position={[...gate.position]} rotation={[0,gate.yaw,0]}>
      <group ref={node=>{gates.current[i]=node;}}><mesh><boxGeometry args={[6,2,.5]} /><meshStandardMaterial color="#cf7456" /></mesh><mesh position={[0,.6,.27]}><boxGeometry args={[5.5,.15,.03]} /><meshBasicMaterial color="#ffe3a2" /></mesh></group>
      {[-3.5,3.5].map(x=><mesh key={x} position={[x,1,0]}><boxGeometry args={[.3,2,.3]} /><meshStandardMaterial color="#eac993" /></mesh>)}
    </group>)}
  </group>;
}

/** Visible track only. Static physics lives in TrackColliders. */
export function Track({ snapshotsRef }: { snapshotsRef?: RefObject<SnapshotBuffer> }) {
  const track = useTrack(), runtimeRef = useTrackRuntimeRef();
  useFrame(({clock})=>{
    const snapshot=snapshotsRef?.current.sampleFrame(clock.elapsedTime);
    if(snapshot) { runtimeRef.current.seconds=snapshot.tick/NETWORK_CONFIG.simulationRateHz; if(snapshot.bridge && runtimeRef.current.bridge) Object.assign(runtimeRef.current.bridge,snapshot.bridge); }
  },-1);
  return (
    <group>
      <TrackSupports />
      <RoadSurface data={track.geometry} />
      <Curbs data={track.geometry} />
      <GuardRails data={track.geometry} />
      {track.branches.filter(branch=>!branch.movable).map(branch => <group key={branch.id}>
        <RoadSurface data={branch.geometry} color="#454b50" />
        <Curbs data={branch.geometry} />
        <GuardRails data={branch.geometry} />
      </group>)}
      <BridgeSurface />
      <StartGrid />
      <CourseFeatures />
      {track.id === "taipei" ? <TaipeiCrossing /> : null}
    </group>
  );
}
