import { useRapier, type RapierCollider, type RapierRigidBody } from "@react-three/rapier";
import { useCallback, useRef } from "react";
import { KART_CONFIG, KART_WHEEL_POSITIONS } from "../core/kart/kartConfig";

// The center of a bumper can cross a curved curb while both corner probes miss it.
const GROUND_PROBES = [...KART_WHEEL_POSITIONS, [0, 0, -1], [0, 0, 1]];

/** Keep this flat-track prototype attached to nearby drivable surfaces.
 * Guard rails must never become ground, and a missing surface must still allow falling.
 */
export function useKartGrounding() {
  const { world, rapier, colliderStates } = useRapier();
  const rayRef = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }));
  const isGround = useCallback((collider: RapierCollider) => {
    const name = colliderStates.get(collider.handle)?.object.name;
    return name === "track-road" || name === "track-curb" || name === "track-ground";
  }, [colliderStates]);

  return useCallback((body: RapierRigidBody, yaw: number) => {
    const ray = rayRef.current;
    const position = body.translation();
    const { probeLift, probeHalfLength, snapDistance, clearance } = KART_CONFIG.grounding;
    const rideHeight = KART_CONFIG.wheels.radius - KART_CONFIG.wheels.centerY;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    let surfaceHeight = Number.NEGATIVE_INFINITY;

    for (const [x, , wheelZ] of GROUND_PROBES) {
      // Probe just beyond the bumper so a curb can be mounted before its side
      // blocks the chassis; sampling only wheel centers pins the nose to steps.
      const z = Math.sign(wheelZ) * probeHalfLength;
      ray.origin.x = position.x + x * cos + z * sin;
      ray.origin.y = position.y + probeLift;
      ray.origin.z = position.z - x * sin + z * cos;
      const hit = world.castRayAndGetNormal(
        ray, rideHeight + probeLift + snapDistance, true,
        undefined, undefined, undefined, body, isGround,
      );
      if (hit && hit.normal.y > 0.5) {
        surfaceHeight = Math.max(surfaceHeight, ray.origin.y - hit.timeOfImpact);
      }
    }

    if (!Number.isFinite(surfaceHeight)) return;
    const targetHeight = surfaceHeight + rideHeight + clearance;
    if (Math.abs(position.y - targetHeight) > snapDistance) return;

    // Correct the solver's curb/edge lift before interpolation and camera sampling.
    // Horizontal collision response remains Rapier's responsibility.
    position.y = targetHeight;
    body.setTranslation(position, true);
    const velocity = body.linvel();
    velocity.y = 0;
    body.setLinvel(velocity, true);
  }, [world, isGround]);
}
