import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, RepeatWrapping, SRGBColorSpace } from "three";
import { useTrack } from "../track/TrackContext";
import { COURSE_MECHANICS } from "../track/courseDesign";
import { pointAtTrackOffset, type TrackSample } from "../track/trackPath";
import { surfaceOffsetHeight } from "../track/trackSurface";
import { TRACK_CONFIG } from "../track/trackConfig";
import { routeLength, sampleAtDistance } from "../track/trackPlacement";
import { ParkSign } from "./ParkDistrictDetails";

function ribbon(samples: readonly TrackSample[], shortcut: boolean) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  let distance = 0;
  samples.forEach((sample, i) => {
    if (i) distance += Math.hypot(sample.position[0] - samples[i - 1].position[0], sample.position[1] - samples[i - 1].position[1]);
    for (const offset of [-(sample.width ?? 8.4) / 2 + .15, shortcut ? (sample.width ?? 5.8) / 2 - .15 : -.35]) {
      const [x, z] = pointAtTrackOffset(sample, offset);
      positions.push(x, surfaceOffsetHeight(sample, offset) + TRACK_CONFIG.roadTop + .018, z);
      uv.push(uv.length % 4 === 0 ? 0 : 1, distance / 4);
    }
    if (i) { const base = i * 2; indices.push(base - 2, base - 1, base, base - 1, base + 1, base); }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Paint follows the same bank, height, width and zone bounds as handling.
 * The warning hangs over the road without introducing obstructing supports. */
export function CourseFeatures() {
  const track = useTrack(), mechanic = COURSE_MECHANICS[track.id];
  const resources = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = mechanic.color; context.fillRect(0, 0, 128, 128);
      context.strokeStyle = "#263e4d"; context.lineWidth = 6;
      if (track.id === "tainan") {
        context.lineWidth = 3;
        for (let row = 0; row < 4; row++) {
          const y = row * 32;
          context.beginPath(); context.moveTo(0, y); context.lineTo(128, y); context.stroke();
          for (let x = row % 2 ? 32 : 0; x < 128; x += 64) {
            context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + 32); context.stroke();
          }
        }
      } else if (track.id === "taichung") {
        for (let i = 0; i < 12; i++) {
          context.save(); context.translate((i * 37 + 13) % 112, (i * 53 + 9) % 128);
          context.rotate(i * 2.4);
          context.fillStyle = i % 2 ? "#94703d" : "#d9a54f";
          context.beginPath(); context.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2); context.fill();
          context.lineWidth = 1.5; context.beginPath(); context.moveTo(0, -8); context.lineTo(0, 12); context.stroke();
          context.restore();
        }
      } else if (track.id === "harbor") {
        for (let y = 16; y < 128; y += 32) { context.beginPath(); context.moveTo(0, y); context.bezierCurveTo(40, y - 15, 80, y + 15, 128, y); context.stroke(); }
      } else if (track.id === "canyon" || track.id === "volcano") {
        for (let i = 0; i < 24; i++) { context.beginPath(); context.arc((i * 37) % 128, (i * 53) % 128, 3 + i % 3, 0, Math.PI * 2); context.stroke(); }
      } else if (track.id === "forest") {
        for (let y = 16; y < 128; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(64, y + 14); context.lineTo(128, y - 5); context.stroke(); }
      } else {
        for (let y = 32; y <= 128; y += 64) { context.beginPath(); context.moveTo(8, y); context.lineTo(64, y - 28); context.lineTo(120, y); context.stroke(); }
      }
      context.fillStyle = "#fff8de"; context.fillRect(122, 0, 6, 128);
    }
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    const main = track.race.RACE_ROUTE_SAMPLES.filter(sample => sample.raceProgress >= mechanic.from && sample.raceProgress <= mechanic.to);
    const branch = track.branches[0].samples.filter(sample => sample.progress > .3 && sample.progress < .7);
    return { texture, geometries: [ribbon(main, false), ribbon(branch, true)] };
  }, [track, mechanic]);
  const movingTexture = useRef<CanvasTexture | null>(null);
  useEffect(() => {
    movingTexture.current = resources.texture;
    return () => { movingTexture.current = null; resources.texture.dispose(); resources.geometries.forEach(geometry => geometry.dispose()); };
  }, [resources]);
  useFrame((_, delta) => {
    // Belt motion conveys its direction; speed gain remains server-owned.
    if (track.id === "clockwork" && movingTexture.current) movingTexture.current.offset.y = (movingTexture.current.offset.y - Math.min(delta, .05) * .8) % 1;
  });
  const warnings = useMemo(() => {
    const route = track.race.RACE_ROUTE_SAMPLES;
    return [mechanic.from - .025, track.branches[0].entryProgress - .025].map(fraction => {
      const sample = sampleAtDistance(route, fraction * routeLength(route));
      return { sample, yaw: Math.atan2(-sample.tangent[0], -sample.tangent[1]) };
    });
  }, [track, mechanic]);
  return <group name={`${track.id}-course-mechanic`}>
    {resources.geometries.map((geometry, i) => <mesh key={i} geometry={geometry} receiveShadow>
      <meshStandardMaterial map={resources.texture} roughness={track.id === "aurora" || track.id === "harbor" ? .25 : .85} />
    </mesh>)}
    {warnings.map(({ sample, yaw }, i) => <group key={i} position={[sample.position[0], sample.height - 3.5, sample.position[1]]} rotation={[0, yaw, 0]}>
      <ParkSign title={i ? mechanic.shortcutCue ? track.branches[0].name : "SKILL SHORTCUT" : mechanic.name} cue={i ? mechanic.shortcutCue ?? "NARROW / KEEP YOUR LINE / BOOST THROUGH" : mechanic.cue} color={mechanic.color} />
    </group>)}
  </group>;
}
