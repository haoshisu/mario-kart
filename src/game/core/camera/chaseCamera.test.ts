import { expect, it } from "vitest";
import { CHASE_CAMERA_CONFIG, createChaseCamera, stepChaseCamera } from "./chaseCamera";

it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])("stays behind the player's rear at heading %s", (yaw) => {
  const state = createChaseCamera();
  stepChaseCamera(state, { position: [12, 0.52, -7], yaw, spinOutRemaining: 0 }, "racing", 1 / 60);
  const dx = state.position.x - 12;
  const dz = state.position.z + 7;
  expect(Math.hypot(dx, dz)).toBeCloseTo(CHASE_CAMERA_CONFIG.distance);
  expect(dx * -Math.sin(yaw) + dz * -Math.cos(yaw)).toBeCloseTo(-CHASE_CAMERA_CONFIG.distance);
  expect(state.position.y).toBeCloseTo(0.52 + CHASE_CAMERA_CONFIG.height);
});

it("holds the camera heading during spin-out, then smoothly resumes following", () => {
  const state = createChaseCamera();
  const player = { position: [0, 0.52, 0] as const, yaw: 0, spinOutRemaining: 0 };
  stepChaseCamera(state, player, "racing", 1 / 60);
  stepChaseCamera(state, { ...player, yaw: 2, spinOutRemaining: 0.5 }, "racing", 1 / 60);
  expect(state.motion.yaw.value).toBe(0);
  stepChaseCamera(state, { ...player, yaw: 2 }, "racing", 1 / 60);
  expect(state.motion.yaw.value).toBeGreaterThan(0);
  expect(state.motion.yaw.value).toBeLessThan(2);
});

it("snaps to respawns and resets heading when returning to the starting grid", () => {
  const state = createChaseCamera();
  stepChaseCamera(state, { position: [0, 0.52, 0], yaw: 0, spinOutRemaining: 0 }, "racing", 1 / 60);
  stepChaseCamera(state, { position: [20, 0.52, 10], yaw: 2, spinOutRemaining: 0 }, "racing", 1 / 60);
  expect(state.motion.yaw.value).toBeCloseTo(2);
  stepChaseCamera(state, { position: [20, 0.52, 10], yaw: -1, spinOutRemaining: 0 }, "countdown", 1 / 60);
  expect(state.motion.yaw.value).toBeCloseTo(-1);
});
