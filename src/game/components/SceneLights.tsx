import { SceneReflections } from "../rendering/SceneReflections";
import { useTrack } from "../track/TrackContext";
import { useRenderQuality } from "../rendering/RenderSettings";
import { useMemo } from "react";
import { Object3D } from "three";

export function SceneLights() {
  const track = useTrack();
  const quality = useRenderQuality();
  const target = useMemo(() => {
    const object = new Object3D();
    object.position.set(track.bounds.centerX, 0, track.bounds.centerZ);
    return object;
  }, [track]);
  const extent = Math.max(track.bounds.width, track.bounds.depth) / 2 + 25;
  return (
    <>
      <SceneReflections />
      <ambientLight intensity={0.18} />
      <hemisphereLight color="#dcecff" groundColor="#26351e" intensity={.75} />
      <directionalLight
        target={target}
        castShadow={quality === "standard"}
        color={track.sunlight}
        intensity={track.id === "tainan" ? 1.9 : track.id === "taipei" ? 1.65 : track.id === "harbor" || track.id === "aurora" ? 2.3 : 3.0}
        position={track.id === "taipei" ? [track.bounds.centerX - 65, 65, track.bounds.centerZ - 40] : [track.bounds.centerX + 25, 90, track.bounds.centerZ + 20]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-camera-bottom={-extent}
        shadow-camera-far={250}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <primitive object={target} />
    </>
  );
}
