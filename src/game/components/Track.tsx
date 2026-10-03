import { TrackSupports } from "./TrackSupports";
import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { TrackMeshData } from "../track/trackGeometry";
import { TRACK_CONFIG } from "../track/trackConfig";
import { useTrack } from "../track/TrackContext";

function createBufferGeometry(data: TrackMeshData) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(data.vertices, 3));
  geometry.setIndex(Array.from(data.indices));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function RoadSurface() {
  const { geometry: { ROAD_MESH_DATA, ROAD_EDGE_MESH_DATA }, colors: TRACK_COLORS } = useTrack();
  const geometry = useMemo(() => createBufferGeometry(ROAD_MESH_DATA), [ROAD_MESH_DATA]);

  const edges = useMemo(() => createBufferGeometry(ROAD_EDGE_MESH_DATA), [ROAD_EDGE_MESH_DATA]);
  return (
    <group>
    <mesh geometry={edges} receiveShadow><meshStandardMaterial color="#fff3cc" roughness={.9} /></mesh>
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={TRACK_COLORS.asphalt} metalness={0.04} roughness={0.9} />
    </mesh>
    </group>
  );
}

function Curbs() {
  const { geometry: { RED_CURB_MESH_DATA, WHITE_CURB_MESH_DATA }, colors: TRACK_COLORS } = useTrack();
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

function GuardRailInstances({ stripe }: { stripe: "red" | "white" }) {
  const { geometry: { GUARD_RAIL_SEGMENTS }, colors: TRACK_COLORS } = useTrack();
  const segments = GUARD_RAIL_SEGMENTS.filter((segment) => segment.stripe === stripe);

  return (
    <Instances castShadow frames={1} limit={segments.length} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={stripe === "red" ? TRACK_COLORS.railRed : TRACK_COLORS.railWhite}
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

function GuardRails() {
  return (
    <>
      <GuardRailInstances stripe="red" />
      <GuardRailInstances stripe="white" />
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

/** Visible track only. Static physics lives in TrackColliders. */
export function Track() {
  return (
    <group>
      <TrackSupports />
      <RoadSurface />
      <Curbs />
      <GuardRails />
      <StartGrid />
    </group>
  );
}
