import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import type { TrackData } from "../track/trackData";
import { sampleTrackSurface } from "../track/trackSurface";
import { ITEM_CONFIG } from "../core/items/itemConfig";
import { TRACK_CONFIG } from "../track/trackConfig";

type BoostPad = TrackData["items"]["BOOST_PADS"][number];
const origin = [0, 0, 0] as const;
function BoostStrip({ pad, pivot = origin }: { pad: BoostPad; pivot?: readonly [number, number, number] }) {
  return <group position={[pad.position[0] - pivot[0], pad.height + TRACK_CONFIG.roadTop + .02 - pivot[1], pad.position[1] - pivot[2]]}
    rotation={[pad.pitch, pad.yaw, pad.roll, "YXZ"]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[ITEM_CONFIG.padRadius * 1.4, ITEM_CONFIG.padRadius * 1.4]} />
      <meshStandardMaterial color="#ffe761" emissive="#e69021" emissiveIntensity={1.5} />
    </mesh>
    {[-.5, 0, .5].map(offset => <group key={offset} position={[0, .015, offset]}>
      {[-1, 1].map(side => <mesh key={side} position={[side * .24, 0, 0]} rotation={[0, side * Math.PI / 4, 0]}>
        <boxGeometry args={[.12, .025, .7]} /><meshBasicMaterial color="#28514c" />
      </mesh>)}
    </group>)}
  </group>;
}
export function BoostPads() {
  const track = useTrack(), runtimeRef = useTrackRuntimeRef(), rotating = useRef<Group>(null);
  const pads = useMemo(() => {
    const fixed: BoostPad[] = [], moving: BoostPad[] = [];
    for (const pad of track.items.BOOST_PADS) {
      const progress = track.bridge && pad.id.startsWith("bridge-pad")
        ? sampleTrackSurface(...pad.position, track.bridge.branch.samples, undefined, { closed: false }).progress ?? 0 : 0;
      (progress >= .4 && progress <= .6 ? moving : fixed).push(pad);
    }
    return { fixed, moving };
  }, [track]);
  useFrame(() => {
    if (rotating.current) rotating.current.rotation.y = runtimeRef.current.bridge?.angle ?? 0;
  });
  return <group name="boost-strips">
    {pads.fixed.map(pad => <BoostStrip key={pad.id} pad={pad} />)}
    {track.bridge && <group ref={rotating} position={[...track.bridge.pivot]}>
      {pads.moving.map(pad => <BoostStrip key={pad.id} pad={pad} pivot={track.bridge?.pivot} />)}
    </group>}
  </group>;
}
