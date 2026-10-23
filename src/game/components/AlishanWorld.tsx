import { useEffect, useMemo } from "react";
import { useTrack } from "../track/TrackContext";
import { useRenderQuality } from "../rendering/RenderSettings";
import { alishanWorldGeometry } from "../rendering/alishanWorldGeometry";

export function AlishanWorld() {
  const track = useTrack(), quality = useRenderQuality();
  const geometry = useMemo(() => alishanWorldGeometry(track, quality === "low"), [track, quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="alishan-continuous-forest" geometry={geometry}>
    <meshStandardMaterial vertexColors roughness={1} fog={false} />
  </mesh>;
}
