import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import {
  createBufferGeometry,
  GUARD_RAIL_SEGMENTS,
  RED_CURB_MESH_DATA,
  ROAD_MESH_DATA,
  WHITE_CURB_MESH_DATA,
} from "../track/trackGeometry";
import { TRACK_COLORS, TRACK_CONFIG } from "../track/trackConfig";
import { FINISH_MARKER } from "../core/race/raceTrack";

function RoadSurface() {
  const geometry = useMemo(() => createBufferGeometry(ROAD_MESH_DATA), []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={TRACK_COLORS.asphalt} metalness={0.04} roughness={0.9} />
    </mesh>
  );
}

function Curbs() {
  const redGeometry = useMemo(() => createBufferGeometry(RED_CURB_MESH_DATA), []);
  const whiteGeometry = useMemo(() => createBufferGeometry(WHITE_CURB_MESH_DATA), []);

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
          rotation={[0, segment.rotationY, 0]}
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
  const columns = 8;
  const rows = 2;
  const tileWidth = TRACK_CONFIG.roadWidth / columns;
  const tileLength = 0.48;

  return (
    <group>
      {Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const isLight = (column + row) % 2 === 0;
        const forwardOffset = (row - (rows - 1) / 2) * tileLength;
        const lateralOffset = (column - (columns - 1) / 2) * tileWidth;

        return (
          <mesh
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
            receiveShadow
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[tileLength, tileWidth]} />
            <meshStandardMaterial color={isLight ? "#f6f0df" : "#1b1e20"} roughness={0.88} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Visible track only. Static physics lives in TrackColliders. */
export function Track() {
  return (
    <group>
      <RoadSurface />
      <Curbs />
      <GuardRails />
      <StartGrid />
    </group>
  );
}
