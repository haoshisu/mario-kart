import { useTrack } from "../track/TrackContext";
import { ITEM_CONFIG } from "../core/items/itemConfig";
import { TRACK_CONFIG } from "../track/trackConfig";
export function BoostPads() {
  const { items: { BOOST_PADS } } = useTrack();
  return <group name="boost-strips">
    {BOOST_PADS.map((pad) => <group key={pad.id} position={[pad.position[0], pad.height + TRACK_CONFIG.roadTop + 0.02, pad.position[1]]}
      rotation={[pad.pitch, pad.yaw, pad.roll, "YXZ"]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[ITEM_CONFIG.padRadius, 24]} />
        <meshStandardMaterial color="#ffe761" emissive="#e69021" emissiveIntensity={1.2} />
      </mesh>
      {[-0.6, 0, 0.6].map((offset) => <group key={offset} position={[0, 0.015, offset]}>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.24, 0, 0]} rotation={[0, side * Math.PI / 4, 0]}>
          <boxGeometry args={[0.12, 0.025, 0.7]} /><meshBasicMaterial color="#28514c" />
        </mesh>)}
      </group>)}
    </group>)}
  </group>;
}
