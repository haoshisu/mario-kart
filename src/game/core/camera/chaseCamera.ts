import { NETWORK_CONFIG } from "../../network/networkConfig";
import type { MultiplayerPhase, PlayerSnapshot } from "../../network/protocol";
import { createCameraMotion, stepCameraMotion } from "./cameraMotion";

export const CHASE_CAMERA_CONFIG = { distance: 7, height: 2.8, lookAhead: 3.2, targetHeight: 0.55 } as const;

export function createChaseCamera() {
  return {
    motion: createCameraMotion(),
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    kartPosition: { x: 0, y: 0, z: 0 },
    heading: 0,
    revision: 0,
    phase: "lobby" as MultiplayerPhase,
  };
}

export function stepChaseCamera(
  state: ReturnType<typeof createChaseCamera>,
  player: Pick<PlayerSnapshot, "position" | "yaw" | "spinOutRemaining">,
  phase: MultiplayerPhase,
  delta: number,
) {
  const [x, y, z] = player.position;
  const reset = !state.motion.initialized ||
    Math.hypot(x - state.kartPosition.x, z - state.kartPosition.z) > NETWORK_CONFIG.teleportDistance ||
    (phase !== state.phase && (phase === "countdown" || phase === "lobby"));
  if (reset) state.revision += 1;
  // Keep the view steady while the kart spins; recover heading smoothly afterwards.
  if (reset || player.spinOutRemaining <= 0) state.heading = player.yaw;
  state.kartPosition.x = x;
  state.kartPosition.y = y;
  state.kartPosition.z = z;
  stepCameraMotion(state.motion, state.kartPosition, state.heading, delta, state.revision);
  const forwardX = -Math.sin(state.motion.yaw.value);
  const forwardZ = -Math.cos(state.motion.yaw.value);
  state.position.x = x - forwardX * CHASE_CAMERA_CONFIG.distance;
  state.position.y = state.motion.y.value + CHASE_CAMERA_CONFIG.height;
  state.position.z = z - forwardZ * CHASE_CAMERA_CONFIG.distance;
  state.target.x = x + forwardX * CHASE_CAMERA_CONFIG.lookAhead;
  state.target.y = state.motion.y.value + CHASE_CAMERA_CONFIG.targetHeight;
  state.target.z = z + forwardZ * CHASE_CAMERA_CONFIG.lookAhead;
  state.phase = phase;
}
