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

it("snaps camera height on a vertical respawn instead of chasing through the road", () => {
  const state = createChaseCamera();
  stepChaseCamera(state, { position: [0, -6, 0], yaw: 0, spinOutRemaining: 0 }, "racing", 1 / 60);
  stepChaseCamera(state, { position: [0, 8, 0], yaw: 0, spinOutRemaining: 0 }, "racing", 1 / 60);
  expect(state.revision).toBe(2);
  expect(state.position.y).toBeCloseTo(8 + CHASE_CAMERA_CONFIG.height);
});


it("widens the view smoothly with speed and keeps constant kart-relative height on slopes", () => {
  const state = createChaseCamera();
  for (let i = 0; i < 120; i++) {
    const y = .52 + i * .1;
    stepChaseCamera(state, { position: [i * .25, y, 0], yaw: 0, spinOutRemaining: 0, speed: 23 }, "racing", 1 / 60);
    expect(state.position.y - y).toBeCloseTo(CHASE_CAMERA_CONFIG.height - CHASE_CAMERA_CONFIG.speedHeight);
    expect(state.fov).toBe(CHASE_CAMERA_CONFIG.baseFov + CHASE_CAMERA_CONFIG.speedFov);
  }
  stepChaseCamera(state, { position: [30, 12.52, 0], yaw: 0, spinOutRemaining: 0, speed: 0 }, "racing", 1 / 60);
  expect(state.fov).toBeGreaterThan(CHASE_CAMERA_CONFIG.baseFov);
  expect(state.fov).toBeLessThan(CHASE_CAMERA_CONFIG.baseFov + CHASE_CAMERA_CONFIG.speedFov);
  for (let i = 0; i < 180; i++) stepChaseCamera(state, { position: [30, 12.52, 0], yaw: 0, spinOutRemaining: 0, speed: 0 }, "racing", 1 / 60);
  expect(state.fov).toBeCloseTo(CHASE_CAMERA_CONFIG.baseFov, 4);
});
