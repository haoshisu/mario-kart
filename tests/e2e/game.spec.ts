import { sampleTrackSurface } from "../../src/game/track/trackSurface";
import { expect, test, type Page } from "@playwright/test";
import { TRACK_SAMPLES } from "../../src/game/track/trackPath";

const TRACK_POINTS = TRACK_SAMPLES.map((sample) => sample.position);

function monitorBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openReadyGame(page: Page, path = "/game?mode=solo") {
  await page.goto(path);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("game-hud")).toBeVisible();
  await expect
    .poll(() => page.getByTestId("kart-runtime").getAttribute("data-race-phase"), {
      timeout: 20_000,
    })
    .toBe("RACING");
  await expect(page.getByTestId("kart-status")).toHaveText("READY", { timeout: 20_000 });
}

async function releaseDrivingKeys(page: Page) {
  for (const key of ["KeyW", "KeyA", "KeyS", "KeyD", "Space"]) {
    await page.keyboard.up(key);
  }
}

async function waitForNumericAttribute(
  page: Page,
  testId: string,
  attribute: string,
  minimum: number,
  timeout = 5_000,
) {
  return page.getByTestId(testId).evaluate(
    (element, options) =>
      new Promise<number>((resolve, reject) => {
        const read = () => Number(element.getAttribute(options.attribute));
        const finish = () => {
          const value = read();
          if (value >= options.minimum) {
            observer.disconnect();
            clearTimeout(timer);
            resolve(value);
          }
        };
        const observer = new MutationObserver(finish);
        const timer = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Timed out waiting for ${options.attribute}`));
        }, options.timeout);
        observer.observe(element, { attributes: true, attributeFilter: [options.attribute] });
        finish();
      }),
    { attribute, minimum, timeout },
  );
}

test("countdown locks movement and starts the race clock at GO", async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page, "/game?mode=solo&e2e=1");
  await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-restart")));
  await expect(page.getByTestId("countdown-cue")).toHaveText("3");

  const runtime = page.getByTestId("kart-runtime");
  const before = {
    x: Number(await runtime.getAttribute("data-x")),
    z: Number(await runtime.getAttribute("data-z")),
  };
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(350);
  await page.keyboard.up("KeyW");
  const after = {
    x: Number(await runtime.getAttribute("data-x")),
    z: Number(await runtime.getAttribute("data-z")),
  };
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.08);

  await expect.poll(() => runtime.getAttribute("data-race-phase")).toBe("RACING");
  await expect
    .poll(async () => Number((await page.getByTestId("race-time").textContent())?.split(":")[1]))
    .toBeGreaterThan(0);
  expect(browserErrors).toEqual([]);
});

test("loads, accelerates, charges drift, and switches inspection mode without errors", async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page);

  await page.keyboard.down("KeyW");
  // Begin at drift speed while there is still room before the first corner.
  await expect
    .poll(async () => Number(await page.getByTestId("kart-runtime").getAttribute("data-speed")), { intervals: [25] })
    .toBeGreaterThan(6);

  await page.keyboard.down("KeyD");
  await page.keyboard.down("Space");
  await expect.poll(() => page.getByTestId("kart-status").textContent(), { intervals: [16] }).toBe("DRIFTING");
  await waitForNumericAttribute(page, "kart-runtime", "data-drift-tier", 1);
  await page.keyboard.up("KeyD");
  await expect(page.getByTestId("kart-status")).toHaveText("DRIFT LEVEL 1");
  await page.keyboard.up("Space");
  await page.keyboard.up("KeyW");

  await page.getByRole("button", { name: "檢查賽道" }).click();
  await expect(page.getByRole("button", { name: "返回駕駛" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("checkpoint trajectory completes three laps, locks the result, and restarts", async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page, "/game?mode=solo&e2e=1");
  const runtime = page.getByTestId("kart-runtime");

  for (let crossing = 0; crossing < 12; crossing += 1) {
    await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-advance")));
    await page.waitForTimeout(35);
  }

  await expect(page.getByTestId("finish-screen")).toBeVisible();
  await expect.poll(() => runtime.getAttribute("data-race-phase")).toBe("FINISHED");
  await expect(runtime).toHaveAttribute("data-completed-laps", "3");
  await expect(page.getByTestId("lap-value")).toHaveText("3 / 3");
  const lockedTime = await page.getByTestId("race-time").textContent();
  await page.waitForTimeout(350);
  await expect(page.getByTestId("race-time")).toHaveText(lockedTime ?? "");

  await page.getByRole("button", { name: "重新比賽" }).click();
  await expect(page.getByTestId("countdown-cue")).toHaveText("3");
  await expect.poll(() => runtime.getAttribute("data-race-phase")).toBe("COUNTDOWN");
  await expect(runtime).toHaveAttribute("data-completed-laps", "0");
  expect(browserErrors).toEqual([]);
});

test("out-of-bounds recovery returns to the latest valid checkpoint with input protection", async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page, "/game?mode=solo&e2e=1");
  const runtime = page.getByTestId("kart-runtime");

  await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-advance")));
  await expect(runtime).toHaveAttribute("data-checkpoint", "1");
  const protectedSpeeds = await runtime.evaluate(
    (element) =>
      new Promise<number[]>((resolve, reject) => {
        const samples: number[] = [];
        const cleanup = () => {
          observer.disconnect();
          window.clearTimeout(timeout);
          window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
        };
        const sample = () => {
          const protection = Number(element.getAttribute("data-respawn-protection"));
          if (protection > 0) {
            samples.push(Math.abs(Number(element.getAttribute("data-speed"))));
          } else if (samples.length > 0) {
            cleanup();
            resolve(samples);
          }
        };
        const observer = new MutationObserver(sample);
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("Timed out while observing respawn protection"));
        }, 3_000);
        observer.observe(element, {
          attributes: true,
          attributeFilter: ["data-respawn-protection", "data-speed"],
        });
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
        window.dispatchEvent(new Event("kart-race-test-respawn"));
      }),
  );
  expect(protectedSpeeds.length).toBeGreaterThan(0);
  expect(Math.max(...protectedSpeeds)).toBeLessThan(0.05);
  await expect(runtime).toHaveAttribute("data-respawns", "1");
  await page.keyboard.down("KeyW");
  await expect
    .poll(async () => Number(await runtime.getAttribute("data-speed")))
    .toBeGreaterThan(1);
  await page.keyboard.up("KeyW");
  await expect(runtime).toHaveAttribute("data-checkpoint", "1");
  await expect(runtime).toHaveAttribute("data-completed-laps", "0");
  expect(browserErrors).toEqual([]);
});

test("controlled cornering reaches all three drift levels and triggers the level-three turbo", async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page);
  const runtime = page.getByTestId("kart-runtime");
  const result = await runtime.evaluate(
    (element, trackPoints) =>
      new Promise<{ maximumTier: number; turboTier: number }>((resolve) => {
        let steering: "left" | "right" | "none" = "none";
        let drifting = false;
        let released = false;
        let maximumTier = 0;

        const key = (code: string, pressed: boolean) => {
          window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", { code }));
        };
        const setSteering = (next: typeof steering) => {
          if (next === steering) return;
          if (steering === "left") key("KeyA", false);
          if (steering === "right") key("KeyD", false);
          if (next === "left") key("KeyA", true);
          if (next === "right") key("KeyD", true);
          steering = next;
        };
        const finish = (turboTier: number) => {
          window.clearInterval(interval);
          window.clearTimeout(timeout);
          key("Space", false);
          key("KeyW", false);
          setSteering("none");
          resolve({ maximumTier, turboTier });
        };

        key("KeyW", true);
        const interval = window.setInterval(() => {
          const current = {
            x: Number(element.getAttribute("data-x")),
            z: Number(element.getAttribute("data-z")),
            yaw: Number(element.getAttribute("data-yaw")),
            speed: Number(element.getAttribute("data-speed")),
            driftTier: Number(element.getAttribute("data-drift-tier")),
            turboTier: Number(element.getAttribute("data-turbo-tier")),
          };
          maximumTier = Math.max(maximumTier, current.driftTier);

          let nearest = 0;
          let nearestDistance = Number.POSITIVE_INFINITY;
          for (let index = 0; index < trackPoints.length; index += 1) {
            const [sampleX, sampleZ] = trackPoints[index];
            const distance = (sampleX - current.x) ** 2 + (sampleZ - current.z) ** 2;
            if (distance < nearestDistance) {
              nearest = index;
              nearestDistance = distance;
            }
          }
          const target = trackPoints[(nearest + 7) % trackPoints.length];
          const desiredYaw = Math.atan2(-(target[0] - current.x), -(target[1] - current.z));
          const yawError = Math.atan2(
            Math.sin(desiredYaw - current.yaw),
            Math.cos(desiredYaw - current.yaw),
          );
          setSteering(yawError > 0.1 ? "left" : yawError < -0.1 ? "right" : "none");

          if (!drifting && current.speed > 6) {
            drifting = true;
            if (steering === "none") setSteering("right");
            key("Space", true);
          }
          if (!released && maximumTier === 3) {
            released = true;
            key("Space", false);
          }
          if (released && current.turboTier === 3) {
            finish(current.turboTier);
          }
        }, 30);
        const timeout = window.setTimeout(() => finish(0), 12_000);
      }),
    TRACK_POINTS,
  );

  expect(result.maximumTier).toBe(3);
  expect(result.turboTier).toBe(3);

  expect(browserErrors).toEqual([]);
});

test("forward and reverse finish-line crossings cannot score without checkpoints", async ({ page }) => {
  test.setTimeout(25_000);
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page);
  const runtime = page.getByTestId("kart-runtime");

  await page.keyboard.down("KeyW");
  await expect
    .poll(async () => Number(await runtime.getAttribute("data-x")))
    .toBeGreaterThan(-5.5);
  await page.keyboard.up("KeyW");
  await expect(runtime).toHaveAttribute("data-completed-laps", "0");

  await page.keyboard.down("KeyS");
  await expect
    .poll(async () => Number(await runtime.getAttribute("data-x")), { timeout: 10_000 })
    .toBeLessThan(-8);
  await page.keyboard.up("KeyS");
  await expect(runtime).toHaveAttribute("data-completed-laps", "0");

  await page.keyboard.down("KeyW");
  await expect
    .poll(async () => Number(await runtime.getAttribute("data-x")), { timeout: 10_000 })
    .toBeGreaterThan(-5.5);
  await page.keyboard.up("KeyW");
  await expect(runtime).toHaveAttribute("data-checkpoint", "0");
  await expect(runtime).toHaveAttribute("data-completed-laps", "0");
  expect(browserErrors).toEqual([]);
});

test("Rapier guard collision produces an Arcade impact response", async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page);

  await page.keyboard.down("KeyW");
  await expect
    .poll(() => page.getByTestId("kart-status").textContent(), {
      intervals: [75],
      timeout: 7_000,
    })
    .toMatch(/WALL HIT|HEAVY IMPACT/);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(300);

  const runtime = page.getByTestId("kart-runtime");
  const beforeReverse = {
    x: Number(await runtime.getAttribute("data-x")),
    z: Number(await runtime.getAttribute("data-z")),
  };
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyS");
  const afterReverse = {
    x: Number(await runtime.getAttribute("data-x")),
    z: Number(await runtime.getAttribute("data-z")),
  };

  expect(Math.hypot(afterReverse.x - beforeReverse.x, afterReverse.z - beforeReverse.z)).toBeGreaterThan(0.3);
  expect(browserErrors).toEqual([]);
});

test("brake reverses and window blur clears held input", async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page);
  const runtime = page.getByTestId("kart-runtime");

  await page.keyboard.down("KeyS");
  await expect
    .poll(async () => Number(await runtime.getAttribute("data-speed")))
    .toBeLessThan(-1);
  await page.keyboard.up("KeyS");

  await page.reload();
  await expect(page.getByTestId("kart-status")).toHaveText("READY", { timeout: 20_000 });
  await page.keyboard.down("KeyW");
  await expect
    .poll(async () => Number(await runtime.getAttribute("data-speed")))
    .toBeGreaterThan(10);
  const speedBeforeBlur = Number(await runtime.getAttribute("data-speed"));

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect
    .poll(async () => Number(await runtime.getAttribute("data-speed")), { timeout: 4_000 })
    .toBeLessThan(speedBeforeBlur);
  await page.keyboard.up("KeyW");

  expect(browserErrors).toEqual([]);
});

test("keyboard driving completes an authoritative three-lap race", async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors = monitorBrowserErrors(page);
  await openReadyGame(page);

  const runtime = page.getByTestId("kart-runtime");
  const sampleCount = TRACK_POINTS.length;
  let unwrappedProgress = 0;
  let previousNearest = 0;
  let steering: "left" | "right" | "none" = "none";
  let completed = false;

  const setSteering = async (next: typeof steering) => {
    if (next === steering) {
      return;
    }
    if (steering === "left") {
      await page.keyboard.up("KeyA");
    } else if (steering === "right") {
      await page.keyboard.up("KeyD");
    }
    if (next === "left") {
      await page.keyboard.down("KeyA");
    } else if (next === "right") {
      await page.keyboard.down("KeyD");
    }
    steering = next;
  };

  await page.keyboard.down("KeyW");

  try {
    for (let iteration = 0; iteration < 1_200; iteration += 1) {
      const current = await runtime.evaluate((element) => ({
        x: Number((element as HTMLElement).dataset.x),
        z: Number((element as HTMLElement).dataset.z),
        yaw: Number((element as HTMLElement).dataset.yaw),
        racePhase: (element as HTMLElement).dataset.racePhase,
      }));

      if (current.racePhase === "FINISHED") {
        completed = true;
        break;
      }

      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < sampleCount; index += 1) {
        const [sampleX, sampleZ] = TRACK_POINTS[index];
        const distance = (sampleX - current.x) ** 2 + (sampleZ - current.z) ** 2;
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      }

      let progressDelta = nearest - previousNearest;
      if (progressDelta < -sampleCount / 2) {
        progressDelta += sampleCount;
      } else if (progressDelta > sampleCount / 2) {
        progressDelta -= sampleCount;
      }
      if (progressDelta >= -3) {
        unwrappedProgress = Math.max(unwrappedProgress, unwrappedProgress + progressDelta);
      }
      previousNearest = nearest;

      const lookAhead = 7;
      const target = TRACK_POINTS[(nearest + lookAhead) % sampleCount];
      const desiredYaw = Math.atan2(-(target[0] - current.x), -(target[1] - current.z));
      const yawError = Math.atan2(
        Math.sin(desiredYaw - current.yaw),
        Math.cos(desiredYaw - current.yaw),
      );

      if (yawError > 0.08) {
        await setSteering("left");
      } else if (yawError < -0.08) {
        await setSteering("right");
      } else {
        await setSteering("none");
      }

      await page.waitForTimeout(55);
    }
  } finally {
    await releaseDrivingKeys(page);
  }

  expect(completed).toBe(true);
  await expect(page.getByTestId("finish-screen")).toBeVisible();
  await expect(runtime).toHaveAttribute("data-completed-laps", "3");
  expect(browserErrors).toEqual([]);
});

for (const turnKey of ["KeyA", "KeyD"]) {
  test(`stays grounded while accelerating and drifting through ${turnKey} turns`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = monitorBrowserErrors(page);
    await openReadyGame(page);
    const runtime = page.getByTestId("kart-runtime");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1000);
    await page.keyboard.down(turnKey);
    let minimumHeight = Number.POSITIVE_INFINITY;
    let maximumHeight = Number.NEGATIVE_INFINITY;
    const startYaw = Number(await runtime.getAttribute("data-yaw"));
    try {
      for (let sample = 0; sample < 80; sample += 1) {
        if (sample === 40) await page.keyboard.down("Space");
        await page.waitForTimeout(100);
        const pose = await runtime.evaluate((node) => ({ x: Number(node.getAttribute("data-x")), y: Number(node.getAttribute("data-y")), z: Number(node.getAttribute("data-z")) }));
        const height = pose.y - sampleTrackSurface(pose.x, pose.z, TRACK_SAMPLES).height;
        minimumHeight = Math.min(minimumHeight, height);
        maximumHeight = Math.max(maximumHeight, height);
      }
      expect(Math.abs(Number(await runtime.getAttribute("data-yaw")) - startYaw)).toBeGreaterThan(1);
      // Clearance must stay bounded relative to the banked, elevated road.
      expect(minimumHeight).toBeGreaterThan(0.4);
      expect(maximumHeight).toBeLessThan(0.65);
      expect(errors).toEqual([]);
    } finally {
      await releaseDrivingKeys(page);
    }
  });
}

test("straight-line displacement stays at top speed across road seams", async ({ page }) => {
  const errors = monitorBrowserErrors(page);
  await openReadyGame(page);
  await page.keyboard.down("KeyW");
  try {
    const samples = await page.getByTestId("kart-runtime").evaluate((element) =>
      new Promise<Array<{ x: number; z: number; time: number; speed: number }>>((resolve) => {
        const samples: Array<{ x: number; z: number; time: number; speed: number }> = [];
        const finish = () => {
          observer.disconnect();
          clearTimeout(timeout);
          resolve(samples);
        };
        const observer = new MutationObserver(() => {
          const sample = {
            x: Number(element.getAttribute("data-x")),
            z: Number(element.getAttribute("data-z")),
            time: Number(element.getAttribute("data-race-time")),
            speed: Number(element.getAttribute("data-speed")),
          };
          samples.push(sample);
          if (sample.x >= 14) finish();
        });
        const timeout = setTimeout(finish, 5000);
        observer.observe(element, { attributes: true, attributeFilter: ["data-race-time"] });
      }),
    );
    const measuredSpeeds: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const previous = samples[i - 1];
      const current = samples[i];
      if (previous.speed < 16.9 || current.speed < 16.9 || current.x > 14) continue;
      const dt = current.time - previous.time;
      if (dt <= 0) continue;
      measuredSpeeds.push(Math.hypot(current.x - previous.x, current.z - previous.z) / dt);
    }
    // Assert distance over simulation time, not the commanded speed displayed by the HUD.
    expect(measuredSpeeds.length).toBeGreaterThanOrEqual(4);
    for (const speed of measuredSpeeds) {
      expect(speed).toBeGreaterThan(16.6);
      expect(speed).toBeLessThan(17.4);
    }
    expect(errors).toEqual([]);
  } finally {
    await releaseDrivingKeys(page);
  }
});
