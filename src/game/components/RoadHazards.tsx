import { useTrack } from "../track/TrackContext";
import { ROAD_HAZARD_CONFIG } from "../core/items/roadHazards";

/** Static oil slicks shared with the authoritative rules; glossy and ringed so they read at speed. */
export function RoadHazards() {
  const hazards = useTrack().items.ROAD_HAZARDS ?? [];
  return <group name="road-hazards">
    {hazards.map(hazard => <group key={hazard.id} position={[hazard.position[0], hazard.height + .04, hazard.position[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ROAD_HAZARD_CONFIG.radius, 20]} />
        <meshStandardMaterial color="#17121f" roughness={.08} metalness={.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[.18, .01, -.12]}>
        <ringGeometry args={[.35, .55, 18]} />
        <meshBasicMaterial color="#7d5cff" transparent opacity={.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .012, 0]}>
        <ringGeometry args={[ROAD_HAZARD_CONFIG.radius - .08, ROAD_HAZARD_CONFIG.radius, 24]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={.75} toneMapped={false} />
      </mesh>
    </group>)}
  </group>;
}
