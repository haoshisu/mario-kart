import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { useTrack } from "../track/TrackContext";

/** Enter inspection above each city instead of orbiting from inside a shop wall. */
export function CityOverviewCamera() {
  const camera = useThree(state => state.camera), track = useTrack();
  useLayoutEffect(() => {
    camera.position.set(track.bounds.centerX + 320, 300, track.bounds.centerZ + (track.id === "taipei" ? 460 : -460));
    camera.lookAt(track.bounds.centerX, .5, track.bounds.centerZ);
  }, [camera, track]);
  return null;
}
