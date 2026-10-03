import { useTrack } from "../track/TrackContext";
import { useRenderQuality } from "../rendering/RenderSettings";

export function SceneLights() {
  const track = useTrack();
  const quality = useRenderQuality();
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight color="#dcecff" groundColor="#26351e" intensity={1.35} />
      <directionalLight
        castShadow={quality === "standard"}
        color={track.sunlight}
        intensity={track.id === "harbor" || track.id === "aurora" ? 1.8 : 2.4}
        position={[25, 60, 20]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-camera-bottom={-65}
        shadow-camera-far={150}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
    </>
  );
}
