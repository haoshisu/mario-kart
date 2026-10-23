import { Instance, Instances } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { useTrack } from "../track/TrackContext";
import { MEADOW_PARK_SECTIONS } from "../track/meadowPark";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import { routeLength, sampleAtDistance } from "../track/trackPlacement";
import { roadQuaternion, sampleTrackSurface, surfaceOffsetHeight } from "../track/trackSurface";
import { THEME_PARK_DISTRICTS } from "../track/themeParks";

const MEADOW_DISTRICTS = [
  { color: "#ffbd65", title: "WELCOME PLAZA", cue: "CLIMB TO THE SKY" },
  { color: "#6cceee", title: "WINDMILL SKYWAY", cue: "JUMP RIGHT / CRUISE CENTER" },
  { color: "#ed99ce", title: "CLOUD GARDENS", cue: "CARVE THE FLOWER BEND" },
  { color: "#87ebbb", title: "GLOWHOUSE", cue: "LEFT: NARROW CUT / RIGHT: WIDE ROAD" },
  { color: "#76dada", title: "WATERFALL GORGE", cue: "WATCH THE GARDENER" },
  { color: "#c5a0ff", title: "PETAL CARNIVAL", cue: "TURBO TO THE FINISH" },
] as const;
const PORTAL = { side: 6.8, height: 8.5, width: 14.2, searchDistance: 9 };

export function ParkSign({ title, cue, color }: { title: string; cue: string; color: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 192;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#153e49"; context.fillRect(0, 0, 1024, 192);
    context.strokeStyle = color; context.lineWidth = 10; context.strokeRect(8, 8, 1008, 176);
    context.textAlign = "center"; context.fillStyle = color;
    context.font = "bold 60px sans-serif"; context.fillText(title, 512, 85);
    context.fillStyle = "#fff6d7"; context.font = "bold 32px sans-serif"; context.fillText(cue, 512, 145);
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace;
    return result;
  }, [title, cue, color]);
  useEffect(() => () => { texture?.dispose(); }, [texture]);
  return <mesh position={[0, PORTAL.height, .38]}>
    <planeGeometry args={[11, 2.06]} /><meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

/** Gate legs and attraction footprints clear both ribbons, including merges.
 * Two beats per district preview the park without adding authoritative obstacles.
 */
export function ParkDistrictDetails() {
  const track = useTrack();
  const districts = track.id === "meadow" ? MEADOW_PARK_SECTIONS.map((section, i) => ({ ...section, ...MEADOW_DISTRICTS[i] })) : THEME_PARK_DISTRICTS[track.id];
  const placements = useMemo(() => {
    const route = track.race.RACE_ROUTE_SAMPLES, length = routeLength(route);
    const roads = [{ samples: track.samples, halfWidth: 4.2 },
      ...track.branches.map(branch => ({ samples: branch.samples, halfWidth: branch.width / 2 }))];
    const clear = (x: number, z: number, radius: number) => roads.every(road =>
      distanceToTrack(x, z, road.samples, { closed: road.samples === track.samples }) > road.halfWidth + radius + .6);
    const sections = track.id === "meadow" ? MEADOW_PARK_SECTIONS : THEME_PARK_DISTRICTS[track.id];
    const gates = sections.flatMap((section, district) => [0, 1].flatMap(beat => {
      // Preview each branch before the player reaches its entrance.
      const branch = track.branches[0];
      const decision = branch && branch.entryProgress >= section.from && branch.entryProgress < section.to;
      const fraction = decision && beat === 0 ? branch.entryProgress - .035 : section.from + .025 + beat * (section.to - section.from) / 2;
      const target = fraction * length;
      for (let shift = 0; shift <= PORTAL.searchDistance; shift += 1) {
        const sample = sampleAtDistance(route, target + shift);
        if (![-1, 1].every(side => {
          const [x, z] = pointAtTrackOffset(sample, side * PORTAL.side);
          return clear(x, z, .6);
        })) continue;
        const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
        const quaternion = roadQuaternion(yaw, sampleTrackSurface(...sample.position, route, undefined, { height: sample.height }));
        return [{ sample, district, entrance: beat === 0, quaternion }];
      }
      return [];
    }));
    const stallLocations = track.id === "meadow" ? [.045, .105, .365, .425, .855, .905, .96].map(fraction =>
      ({ fraction, district: fraction < .16 ? 0 : fraction < .5 ? 2 : 5 })) : sections.map((section, district) =>
        ({ fraction: section.from + (section.to - section.from) * .6, district }));
    const stalls = stallLocations.flatMap(({ fraction, district }) => {
      const sample = sampleAtDistance(route, fraction * length);
      return [-1, 1].flatMap(side => {
        const [x, z] = pointAtTrackOffset(sample, side * 11);
        if (!clear(x, z, 4)) return [];
        return [{ position: [x, surfaceOffsetHeight(sample, side * 11), z] as const,
          yaw: Math.atan2(-sample.tangent[0], -sample.tangent[1]), district }];
      });
    });
    return { gates, stalls };
  }, [track]);

  return <group name={`${track.id}-park-district-attractions`}>
    <Instances frames={1} limit={placements.gates.length * 12 + placements.stalls.length * 16} receiveShadow>
      <boxGeometry /><meshStandardMaterial roughness={.82} />
      {placements.gates.map(({ sample, district, quaternion, entrance }, index) => {
        const { color } = districts[district];
        return <group key={`gate-${index}`} position={[sample.position[0], sample.height, sample.position[1]]}
          quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}>
          {[-1, 1].map(side => <group key={side}>
            <Instance position={[side * PORTAL.side, 4, 0]} scale={[.65, 8, .65]} color="#f8e3be" />
            <Instance position={[side * PORTAL.side, 1, 0]} scale={[1.1, 2, 1.1]} color={color} />
          </group>)}
          <Instance position={[0, PORTAL.height, 0]} scale={[PORTAL.width, entrance ? 2.2 : .4, .65]} color={color} />
          {!entrance && Array.from({ length: 7 }, (_, flag) => <Instance key={flag}
            position={[(flag - 3) * 1.7, PORTAL.height - .65 - Math.abs(flag - 3) * .08, 0]}
            rotation={[0, 0, Math.PI / 4]} scale={[.65, .65, .09]} color={flag % 2 ? color : "#fff3c7"} />)}
        </group>;
      })}
      {placements.stalls.map(({ position, yaw, district }, index) => <group key={`stall-${index}`} position={position} rotation={[0, yaw, 0]}>
        <Instance position={[0, .2, 0]} scale={[6, .4, 5]} color="#eed6af" />
        <Instance position={[0, 1.3, 0]} scale={[4.8, 2.2, 3.4]} color="#ffe7bd" />
        <Instance position={[0, 2, 1.76]} scale={[3.6, 1.2, .08]} color="#305f66" />
        <Instance position={[0, 1.35, 2.1]} scale={[5.1, .3, 1]} color={districts[district].color} />
        {[-2.35, 2.35].map(x => <Instance key={x} position={[x, 2, 2.5]} scale={[.15, 3.6, .15]} color="#f8e3be" />)}
        {Array.from({ length: 8 }, (_, stripe) => <Instance key={stripe} position={[(stripe - 3.5) * .68, 3.3, .5]}
          rotation={[-.15, 0, 0]} scale={[.68, .22, 4.6]} color={stripe % 2 ? districts[district].color : "#fff4d2"} />)}
      </group>)}
    </Instances>
    {placements.gates.filter(gate => gate.entrance).map(({ sample, district, quaternion }) => <group key={district}
      position={[sample.position[0], sample.height, sample.position[1]]} quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}>
      <ParkSign {...districts[district]} />
    </group>)}
  </group>;
}
