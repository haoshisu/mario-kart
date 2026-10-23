import { createChaseCamera, stepChaseCamera } from "./chaseCamera";
import { describe, expect, it } from "vitest";
import { getTrackData } from "../../track/trackData";
import { constrainRoadCamera, createRoadCameraState, frameRoadCamera, roadCameraHasClearView } from "./roadCamera";
import { PerspectiveCamera, Vector3 } from "three";
import { createTrackGeometry } from "../../track/trackGeometry";
import { sampleTrackSurface } from "../../track/trackSurface";

describe("road-aware follow camera", () => {
  const track = getTrackData("meadow");
  it("keeps the lower crossing camera below the sky bridge without changing distance", () => {
    const kart = { x: 0, y: 3.52, z: 67.428 };
    const position = { x: 5.6, y: 6.32, z: 71.6 };
    const original = { ...position };
    const target = { x: -2.6, y: 4.07, z: 65.5 };
    constrainRoadCamera(position, target, kart, track, createRoadCameraState());
    expect(position).toEqual(original);
    expect(position.y).toBeLessThan(16 - .65);
    expect(target.y).toBeLessThan(5);
  });
  it("orbits outside the character while the main deck hides the shortcut kart", () => {
    const current = track.branches[0];
    // Preserve the historical overlapping-deck regression independently of
    // the production shortcut, which now stays level at the branch entrance.
    const samples = current.samples.map(sample => ({ ...sample,
      height: current.samples[0].height + (current.samples[current.samples.length - 1].height - current.samples[0].height)
        * (1 - Math.cos(sample.progress * Math.PI)) / 2 }));
    const branch = { ...current, samples, geometry: createTrackGeometry(samples, { width: current.width, closed: false }) };
    const legacy = { ...track, branches: [branch] };
    // Browser section-3 regression: kart is descending beside the main deck,
    // while heading and vertical camera motion still follow the entry road.
    const sample = track.race.RACE_ROUTE_SAMPLES[Math.round(track.samples.length * .5412)];
    const kart = { x: 28.7478, y: 18.5142, z: 131.373 };
    const position = { x: kart.x - sample.tangent[0] * 7, y: kart.y + 2.8, z: kart.z - sample.tangent[1] * 7 };
    const target = { x: kart.x + sample.tangent[0] * 3.2, y: 21.1, z: kart.z + sample.tangent[1] * 3.2 };
    const distance = Math.hypot(position.x - kart.x, position.y - kart.y, position.z - kart.z);
    constrainRoadCamera(position, target, kart, legacy, createRoadCameraState());
    expect(Math.hypot(position.x - kart.x, position.y - kart.y, position.z - kart.z)).toBeLessThan(distance - 1);
    expect(Math.hypot(position.x - kart.x, position.z - kart.z)).toBeGreaterThanOrEqual(3);
    expect(roadCameraHasClearView(position, { x: kart.x, y: kart.y + .55, z: kart.z }, legacy)).toBe(true);
    expect(target).toEqual({ x: kart.x, y: kart.y + .55, z: kart.z });
    const branchSurface = sampleTrackSurface(position.x, position.z, branch.samples, undefined, { closed: false, height: kart.y - .52 });
    expect(position.y).toBeGreaterThanOrEqual(branchSurface.height + .85 - 1e-6);
  });
  it("keeps an unobstructed upper-deck camera above its own road", () => {
    const sample = track.race.RACE_ROUTE_SAMPLES[Math.round(track.samples.length * .28)];
    const kart = { x: sample.position[0], y: sample.height + .52, z: sample.position[1] };
    const position = { x: kart.x - sample.tangent[0] * 7, y: kart.y + 2.8, z: kart.z - sample.tangent[1] * 7 };
    const original = { ...position };
    const target = { x: kart.x + sample.tangent[0] * 3.2, y: kart.y + .55, z: kart.z + sample.tangent[1] * 3.2 };
    constrainRoadCamera(position, target, kart, track, createRoadCameraState());
    expect(position).toEqual(original);
    expect(target.y).toBeGreaterThan(16);
  });
  it.each(["main", "shortcut"])("avoids orbit flicker throughout the %s slopes", name => {
    const road = name === "main" ? track.samples : track.branches[0].samples;
    const camera = createChaseCamera(), state = createRoadCameraState();
    let previous: { x: number; y: number; z: number } | undefined;
    let maximumStep = 0;
    for (let i = 0; i < road.length - 1; i++) for (let k = 0; k < 4; k++) {
      const a = road[i], b = road[i + 1], fraction = k / 4;
      const x = a.position[0] + (b.position[0] - a.position[0]) * fraction;
      const z = a.position[1] + (b.position[1] - a.position[1]) * fraction;
      const height = sampleTrackSurface(x, z, road, undefined, { closed: name === "main" }).height;
      stepChaseCamera(camera, { position: [x, height + .52, z],
        yaw: Math.atan2(-a.tangent[0], -a.tangent[1]), spinOutRemaining: 0, speed: 17 }, "racing", 1 / 60);
      constrainRoadCamera(camera.position, camera.target, camera.kartPosition, track, state, 1 / 60, camera.revision);
      if (previous) maximumStep = Math.max(maximumStep,
        Math.hypot(camera.position.x - previous.x, camera.position.y - previous.y, camera.position.z - previous.z));
      expect(roadCameraHasClearView(camera.position, state.focus, track)).toBe(true);
      expect(roadCameraHasClearView(camera.position, state.visibilityFocus, track)).toBe(true);
      previous = { ...camera.position };
    }
    // Smooth input used to cause 33 abrupt orbit changes, up to 9.6 m/frame.
    expect(maximumStep).toBeLessThan(1);
  });

  it.each([16 / 9, 9 / 16])("keeps the driver above the controls across slopes at aspect %s", aspect => {
    const state = createRoadCameraState(), chase = createChaseCamera();
    const lens = new PerspectiveCamera(44, aspect, .1, 240), anchor = new Vector3();
    const road = track.samples;
    const dt = 1 / 60;
    let framed = 0, uphill = 0, downhill = 0;
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i], b = road[i + 1];
      const length = Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1]);
      const frames = Math.max(1, Math.ceil(length / (17 * dt)));
      for (let k = 0; k < frames; k++) {
        const fraction = k / frames;
        const x = a.position[0] + (b.position[0] - a.position[0]) * fraction;
        const z = a.position[1] + (b.position[1] - a.position[1]) * fraction;
        const y = sampleTrackSurface(x, z, road, undefined, { height: a.height }).height + .52;
        stepChaseCamera(chase, { position: [x, y, z], yaw: Math.atan2(-a.tangent[0], -a.tangent[1]),
          speed: 17, spinOutRemaining: 0 }, "racing", dt);
        constrainRoadCamera(chase.position, chase.target, chase.kartPosition, track, state, dt, chase.revision);
        lens.fov = 2 * Math.atan(Math.tan(chase.fov * Math.PI / 360) / Math.min(1, aspect)) * 180 / Math.PI;
        lens.updateProjectionMatrix();
        const before = { ...chase.position };
        frameRoadCamera(chase.position, chase.target, chase.kartPosition, lens.fov, state, dt);
        expect(chase.position).toEqual(before);
        expect(roadCameraHasClearView(chase.position, state.focus, track)).toBe(true);
        if (state.orbiting) continue;
        lens.position.set(chase.position.x, chase.position.y, chase.position.z);
        lens.lookAt(chase.target.x, chase.target.y, chase.target.z);
        lens.updateMatrixWorld();
        anchor.set(x, y + .55, z).project(lens);
        const screenHeight = (1 - anchor.y) / 2;
        expect(screenHeight).toBeGreaterThanOrEqual(.65);
        expect(screenHeight).toBeLessThanOrEqual(.72);
        framed++;
        if (b.height - a.height > .005) uphill++;
        if (b.height - a.height < -.005) downhill++;
      }
    }
    expect(framed).toBeGreaterThan(1000);
    expect(uphill).toBeGreaterThan(100);
    expect(downhill).toBeGreaterThan(100);
  });

  it("smooths framing pitch changes and snaps framing on respawns", () => {
    const state = createRoadCameraState();
    const kart = { x: 0, y: .52, z: 0 };
    const position = { x: 0, y: 3.32, z: 7 }, target = { x: 0, y: 1.07, z: -3.2 };
    frameRoadCamera(position, target, kart, 54, state);
    const initial = state.framingPitch.value;
    position.y += 1;
    frameRoadCamera(position, target, kart, 54, state);
    expect(Math.abs(state.framingPitch.value - initial)).toBeLessThan(.02);
    expect(state.framingPitch.velocity).not.toBe(0);
    state.revision++;
    frameRoadCamera(position, target, kart, 54, state);
    expect(state.framingPitch.velocity).toBe(0);
    expect(state.framingPitch.value).toBeCloseTo(Math.atan2(kart.y + .55 - position.y, 7) + Math.atan(.38 * Math.tan(54 * Math.PI / 360)));
  });

});
