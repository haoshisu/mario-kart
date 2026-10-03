import type { RapierRigidBody } from "@react-three/rapier";
import { useCallback, useRef } from "react";
import { KART_START } from "../core/kart/kartConfig";
import { useTrack } from "../track/TrackContext";
import { TRACK_CONFIG } from "../track/trackConfig";
import { createSurfaceResult, sampleTrackSurface } from "../track/trackSurface";

/** Arcade road adhesion follows the authored slope and bank, never a guardrail.
 * Outside the road, retain gravity and let the ordinary respawn rules recover.
 */
export function useKartGrounding() {
  const track = useTrack();
  const result = useRef(createSurfaceResult());
  return useCallback((body: RapierRigidBody) => {
    const position = body.translation();
    const surface = sampleTrackSurface(position.x, position.z, track.samples, result.current);
    const height = surface.height + KART_START.position[1];
    if (surface.distance > TRACK_CONFIG.roadWidth / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap || Math.abs(position.y - height) > 2) return null;
    body.setTranslation({ x: position.x, y: height, z: position.z }, true);
    return surface;
  }, [track]);
}
