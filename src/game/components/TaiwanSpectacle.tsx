import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import { distanceToTrack } from "../track/trackPath";
import { ForestConvoy } from "./ForestConvoy";
import { TaiwanBoxes, type TaiwanBox } from "./TaiwanProps";

/** Spectacle stays beneath the jump runway and never masks its landing. */
export function TaiwanSpectacle() {
  const track = useTrack(), runtime = useTrackRuntimeRef(), motion = useRef<Group>(null);
  const ramp = track.ramps[0], yaw = ramp.yaw + Math.PI / 2;
  const height = track.id === "alishan" ? Math.max(3, ramp.height - 18) : track.id === "taipei" ? 3 : .8;
  const trestle = useMemo(() => {
    if (track.id !== "alishan") return [];
    const boxes: TaiwanBox[] = [{ position: [0, -.18, 0], scale: [3.8, .35, 80], color: "#816549", surface: "wood" }];
    for (const side of [-1, 1]) {
      boxes.push({ position: [side * .8, .05, 0], scale: [.08, .10, 80], color: "#979784", surface: "metal" });
      for (let z = -36; z <= 36; z += 9) {
        const x = side * 1.55;
        const wx = ramp.position[0] + Math.cos(yaw) * x + Math.sin(yaw) * z;
        const wz = ramp.position[1] - Math.sin(yaw) * x + Math.cos(yaw) * z;
        // A trestle post cannot visually pierce a playable road below it.
        if ([track.samples, ...track.branches.map(b => b.samples)].some(road => distanceToTrack(wx, wz, road, { closed: road === track.samples }) < 6)) continue;
        boxes.push({ position: [x, -height / 2, z], scale: [.45, height, .45], color: "#705641", surface: "wood" });
        boxes.push({ position: [x, -.55, z], scale: [3.2, .25, .3], color: "#816549", surface: "wood" });
      }
    }
    return boxes;
  }, [track, ramp, height, yaw]);
  useFrame(({ clock }) => {
    if (motion.current) motion.current.position.z = Math.sin((runtime.current.seconds || clock.elapsedTime) * .14) * 28;
  });
  if (!["kaohsiung", "taipei", "alishan"].includes(track.id)) return null;
  return <group position={[ramp.position[0], height, ramp.position[1]]} rotation={[0, yaw, 0]} name={`${track.id}-jump-spectacle`}>
    <TaiwanBoxes boxes={trestle} />
    <group ref={motion}>
      {track.id === "alishan" ? <ForestConvoy />
        : track.id === "kaohsiung" ? <>
          <mesh position={[0, 2, 0]} scale={[9, 3, 25]}><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#314f61" /></mesh>
          <TaiwanBoxes boxes={[
            { position: [0, 5, -12], scale: [6, 7, 5], color: "#efddbd" },
            ...Array.from({ length: 8 }, (_, i) => ({ position: [i % 2 ? -2.3 : 2.3, 5, Math.floor(i / 2) * 6 - 6] as const, scale: [4, 4, 5] as const, color: ["#d78c55", "#5ea89f", "#e8bc6f"][i % 3] })),
          ]} />
        </> : <TaiwanBoxes boxes={[
          { position: [0, 1.5, 0], scale: [3, 3, 24], color: "#65c9bc" },
          { position: [0, 3.1, 0], scale: [3.3, .3, 24.5], color: "#dedcc9" },
          ...Array.from({ length: 10 }, (_, i) => ({ position: [0, 2, (i - 4.5) * 2.2] as const, scale: [3.05, .8, 1.6] as const, color: "#36536a" })),
        ]} />}
    </group>
  </group>;
}
