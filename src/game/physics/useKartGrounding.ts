import { sampleDrivingSurface } from "../track/drivingSurface";
import { applyRampSurface } from "../core/stunts/stuntSystem";
import type { RapierRigidBody } from "@react-three/rapier";
import { useCallback, useRef } from "react";
import { KART_CONFIG, KART_START } from "../core/kart/kartConfig";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import { TRACK_CONFIG } from "../track/trackConfig";
import { createSurfaceResult } from "../track/trackSurface";

/** Arcade road adhesion follows the authored slope and bank, never a guardrail.
 * Outside the road, retain gravity and let the ordinary respawn rules recover.
 */
export function useKartGrounding() {
  const track = useTrack(), trackRuntimeRef = useTrackRuntimeRef();
  const result = useRef(createSurfaceResult());
  return useCallback((body: RapierRigidBody) => {
    const position = body.translation();
    const surface = applyRampSurface(position.x, position.z, track.ramps, sampleDrivingSurface(position.x, position.z, track, result.current, position.y - KART_START.position[1], trackRuntimeRef.current.bridge?.locked));
    const height = surface.height + KART_START.position[1];
    if (surface.distance > (surface.width ?? TRACK_CONFIG.roadWidth) / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap || (position.y - height > KART_CONFIG.grounding.snapDistance || height - position.y > 2)) return null;
    body.setTranslation({ x: position.x, y: height, z: position.z }, true);
    return surface;
  }, [track, trackRuntimeRef]);
}
