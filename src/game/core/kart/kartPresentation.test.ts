import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { createCameraMotion, stepCameraMotion } from "../camera/cameraMotion";
import { createKartPresentation, stepKartPresentation } from "./kartPresentation";
import { KART_CONFIG } from "./kartConfig";

const origin = { x: 0, z: 0 };

describe("shared kart presentation", () => {
  it("smooths low-rate target updates without stopping between updates", () => {
    const motion = createKartPresentation();
    stepKartPresentation(motion, origin, 1 / 120, 0);
    for (let frame = 1; frame <= 240; frame++) {
      const previous = motion.x.value;
      stepKartPresentation(motion, { x: Math.floor(frame / 2) * 17 / 60, z: 0 }, 1 / 120, 0);
      if (frame > 120) {
        expect(motion.x.value - previous).toBeGreaterThan(0.1);
        expect(motion.x.value - previous).toBeLessThan(0.18);
      }
    }
  });

  it("keeps the drawn kart fixed on screen through speed changes and uneven frames", () => {
    const presentation = createKartPresentation();
    const motion = createCameraMotion();
    const camera = new PerspectiveCamera(44, 1.6, 0.1, 180);
    const kart = new Vector3();
    const screen = new Vector3();
    const config = KART_CONFIG.camera;
    let z = 0;
    let referenceY = 0;
    for (let frame = 0; frame < 360; frame++) {
      const dt = [1 / 60, 1 / 120, 1 / 30][frame % 3];
      const speed = frame < 120 ? frame / 8 : frame < 240 ? 15 - (frame - 120) / 8 : -3;
      z -= speed * dt;
      stepKartPresentation(presentation, { x: 0, z }, dt, 0);
      kart.set(presentation.x.value, 0.512, presentation.z.value);
      stepCameraMotion(motion, kart, 0, dt, 0);
      camera.position.set(motion.x.value, motion.y.value + config.height, motion.z.value + config.distance);
      camera.lookAt(motion.x.value, motion.y.value + 0.55, motion.z.value - config.lookAhead);
      camera.updateMatrixWorld();
      screen.copy(kart).project(camera);
      if (frame === 0) referenceY = screen.y;
      expect(screen.x).toBeCloseTo(0, 8);
      expect(screen.y).toBeCloseTo(referenceY, 8);
      expect(camera.position.distanceTo(kart)).toBeCloseTo(Math.hypot(config.height, config.distance), 8);
    }
  });

  it("resets visual lag on a new pose revision or long frame gap", () => {
    const motion = createKartPresentation();
    stepKartPresentation(motion, origin, 1 / 60, 0);
    stepKartPresentation(motion, { x: 10, z: 3 }, 1 / 60, 0);
    stepKartPresentation(motion, { x: -10, z: 4 }, 1 / 60, 1);
    expect(motion.x).toEqual({ value: -10, velocity: 0 });
    expect(motion.z).toEqual({ value: 4, velocity: 0 });
    stepKartPresentation(motion, origin, 1, 1);
    expect(motion.x).toEqual({ value: 0, velocity: 0 });
  });
});
