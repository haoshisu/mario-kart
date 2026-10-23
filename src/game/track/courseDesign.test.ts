import { describe, expect, it } from "vitest";
import { TRACK_IDS } from "./trackCatalog";
import { getTrackData } from "./trackData";
import { COURSE_MECHANICS, courseHandling } from "./courseDesign";
import { sampleDrivingSurface } from "./drivingSurface";
import { pointAtTrackOffset } from "./trackPath";
import { createInitialKartState, getKartLateralSpeed, stepKartSimulation } from "../core/kart/kartPhysics";
import { createSurfaceResult } from "./trackSurface";

const input = { throttle: 1, brake: 0, steer: .4, drift: false };
describe.each(TRACK_IDS)("%s authored driving features", id => {
  const track = getTrackData(id), mechanic = COURSE_MECHANICS[id];
  it("applies its mechanic only on the painted lane or shortcut, never in the air", () => {
    const point = track.race.RACE_ROUTE_SAMPLES.find(point => point.raceProgress > (mechanic.from + mechanic.to) / 2);
    if (!point) throw new Error("Missing mechanic runway");
    const left = sampleDrivingSurface(...pointAtTrackOffset(point, -2), track, undefined, point.height);
    expect(courseHandling(id, left, true)).toEqual(mechanic.handling);
    expect(courseHandling(id, left, false)).toBeUndefined();
    const right = sampleDrivingSurface(...pointAtTrackOffset(point, 2), track, undefined, point.height);
    expect(courseHandling(id, right, true)).toBeUndefined();
    const branch = track.branches[0], middle = branch.samples[Math.floor(branch.samples.length / 2)];
    const surface = sampleDrivingSurface(...middle.position, track, undefined, middle.height);
    expect(surface.routeIndex).toBe(1);
    expect(courseHandling(id, surface, true)).toEqual(mechanic.handling);
  });
  it("keeps tapered mesh, physical surface and guardrails at the same width", () => {
    expect(Math.min(...track.samples.map(point => point.width ?? 8.4))).toBeLessThan(8.1);
    const mesh = track.geometry.ROAD_MESH_DATA.vertices;
    track.samples.forEach((point, i) => {
      expect(Math.hypot(mesh[i * 12] - mesh[i * 12 + 3], mesh[i * 12 + 2] - mesh[i * 12 + 5])).toBeCloseTo(point.width ?? 8.4, 4);
      const surface = sampleDrivingSurface(...point.position, track, undefined, point.height);
      expect(surface.width).toBeCloseTo(point.width ?? 8.4, 3);
    });
    const branch = track.branches[0];
    expect(branch.samples[0].width).toBe(branch.width);
    expect(branch.samples.at(-1)?.width).toBe(branch.width);
    expect(Math.min(...branch.samples.map(point => point.width ?? branch.width))).toBeCloseTo(branch.width - 1.2);
    for (let i = 1; i < track.samples.length; i++) expect(Math.abs((track.samples[i].width ?? 8.4) - (track.samples[i - 1].width ?? 8.4))).toBeLessThan(.3);
  });
});

it("theme handling changes motion while boost can overcome soft-surface loss", () => {
  const state = { ...createInitialKartState(), speed: 15 };
  const plain = stepKartSimulation(state, input, 1 / 60).state;
  const sand = stepKartSimulation(state, input, 1 / 60, undefined, COURSE_MECHANICS.canyon.handling).state;
  expect(sand.speed).toBeLessThan(plain.speed);
  const boost = stepKartSimulation(state, input, 1 / 60, { acceleration: 15, maximumSpeed: 23 }, COURSE_MECHANICS.canyon.handling).state;
  expect(boost.speed).toBeGreaterThan(plain.speed);
  const belt = stepKartSimulation(state, input, 1 / 60, undefined, COURSE_MECHANICS.clockwork.handling).state;
  expect(belt.speed).toBeGreaterThan(plain.speed);
  const wind = stepKartSimulation(state, input, 1 / 60, undefined, COURSE_MECHANICS.meadow.handling).state;
  expect(wind.yaw).not.toBe(plain.yaw);
  expect(getKartLateralSpeed(3, 15, .4, false, 1 / 60, COURSE_MECHANICS.aurora.handling)).toBeGreaterThan(getKartLateralSpeed(3, 15, .4, false, 1 / 60));
  const outside = createSurfaceResult(); outside.progress = .4; outside.distance = 20;
  expect(courseHandling("canyon", outside, true)).toBeUndefined();
});

it("the conveyor rewards aligned driving and resists driving against its direction", () => {
  const surface = createSurfaceResult();
  surface.progress = .4; surface.lateral = -2; surface.yaw = 0; surface.distance = 2;
  expect(courseHandling("clockwork", surface, true, 0)?.acceleration).toBe(4);
  expect(courseHandling("clockwork", surface, true, Math.PI)?.acceleration).toBe(-3);
});

it("Tainan bricks cost speed while saving boost lets a driver power through", () => {
  const start = { ...createInitialKartState(), speed: 17 };
  let bricks = start, boosted = start, clear = start;
  const controls = { ...input, steer: 0 };
  for (let frame = 0; frame < 120; frame++) {
    bricks = stepKartSimulation(bricks, controls, 1 / 60, undefined, COURSE_MECHANICS.tainan.handling).state;
    boosted = stepKartSimulation(boosted, controls, 1 / 60,
      { acceleration: 10, maximumSpeed: 23 }, COURSE_MECHANICS.tainan.handling).state;
    clear = stepKartSimulation(clear, controls, 1 / 60).state;
  }
  expect(bricks.speed).toBeGreaterThan(13);
  expect(bricks.speed).toBeLessThan(clear.speed - 2);
  expect(boosted.speed).toBeGreaterThan(clear.speed + 3);
});

it("Taichung leaves preserve forward pace but demand more time to recover from a slide", () => {
  const start = { ...createInitialKartState(), speed: 17 };
  const leaves = COURSE_MECHANICS.taichung.handling;
  expect(stepKartSimulation(start, { ...input, steer: 0 }, 1 / 60, undefined, leaves).state.speed).toBe(17);
  const leafSlide = getKartLateralSpeed(3, 17, 0, false, .05, leaves);
  const brickSlide = getKartLateralSpeed(3, 17, 0, false, .05, COURSE_MECHANICS.tainan.handling);
  expect(leafSlide).toBeGreaterThan(brickSlide * 1.5);
  expect(leafSlide).toBeLessThan(3);
});
