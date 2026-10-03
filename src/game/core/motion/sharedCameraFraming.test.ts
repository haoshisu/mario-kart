import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { updateSharedCameraFrame } from "./sharedCameraFraming";

describe("shared camera framing", () => {
  for (const aspect of [16 / 9, 4 / 3, 9 / 16]) {
    it(`keeps separated karts and nameplates inside the ${aspect} viewport`, () => {
      const frame = { x: 0, z: 0, distance: 0, initialized: false };
      const camera = new PerspectiveCamera(44, aspect, 0.1, 1000);
      const direction = new Vector3(0.54, 0.85, 0.62).normalize();
      for (const separation of [0, 5, 15, 35, 65, 10]) {
        const players = [
          { position: [-30, 0.43, -14], status: "racing" },
          { position: [-30 + separation, 0.43, 18], status: "racing" },
        ];
        updateSharedCameraFrame(frame, players, 44, aspect, 1 / 60);
        const target = new Vector3(frame.x, 0.4, frame.z);
        camera.position.copy(direction).multiplyScalar(frame.distance).add(target);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        for (const player of players) {
          for (const height of [0, 2]) {
            const projected = new Vector3(player.position[0], height, player.position[2]).project(camera);
            expect(Math.abs(projected.x)).toBeLessThan(0.95);
            expect(Math.abs(projected.y)).toBeLessThan(0.95);
            expect(projected.z).toBeLessThan(1);
          }
        }
      }
    });
  }
});
