import { expect, test } from "@playwright/test";
import { getTrackData } from "../../src/game/track/trackData";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { driveRace } from "./driveRace";
import { drivePractice } from "./drivePractice";

test("held brake stops launch turbo and reverses before it expires", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  const runtime = page.getByTestId("kart-runtime");
  await expect(runtime).toHaveAttribute("data-race-phase", "RACING");
  await page.keyboard.down("KeyS");
  await page.evaluate(() => {
    document.documentElement.dataset.reverseDuringTurbo = "false";
    const element = document.querySelector('[data-testid="kart-runtime"]');
    if (!element) throw new Error("Missing kart telemetry");
    const observer = new MutationObserver(() => {
      if (Number(element.getAttribute("data-speed")) < -.5 &&
          Number(element.getAttribute("data-turbo-tier")) > 0) {
        document.documentElement.dataset.reverseDuringTurbo = "true";
        observer.disconnect();
      }
    });
    observer.observe(element, { attributes: true });
    window.setTimeout(() => observer.disconnect(), 10_000);
    window.dispatchEvent(new Event("kart-race-test-restart"));
  });
  try {
    await expect(page.locator("html")).toHaveAttribute("data-reverse-during-turbo", "true", { timeout: 10_000 });
    expect(errors).toEqual([]);
  } finally {
    await page.keyboard.up("KeyS");
  }
});

test("practice collapses the picker and produces gesture-enabled speed audio", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const oscillators: OscillatorNode[] = [], gains: GainNode[] = [];
    const oscillator = AudioContext.prototype.createOscillator, gain = AudioContext.prototype.createGain;
    AudioContext.prototype.createOscillator = function () { const node = oscillator.call(this); oscillators.push(node); return node; };
    AudioContext.prototype.createGain = function () { const node = gain.call(this); gains.push(node); return node; };
    window.setInterval(() => {
      document.documentElement.dataset.audioCreated = String(oscillators.length);
      document.documentElement.dataset.enginePitch = String(oscillators[0]?.frequency.value ?? 0);
      document.documentElement.dataset.audioMaster = String(gains[0]?.gain.value ?? 0);
    }, 50);
  });
  await page.goto("/game?mode=solo&e2e=1&stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING");
  await expect(page.getByRole("group", { name: "選擇賽道" })).toHaveCount(0);
  await expect.poll(async () => Number(await page.locator("html").getAttribute("data-audio-created"))).toBe(0);
  await page.getByRole("button", { name: "選圖與賽事", exact: true }).click();
  await page.getByRole("button", { name: /霓虹疊城/ }).click();
  await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", "taipei");
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING");
  await expect(page.getByRole("group", { name: "選擇賽道" })).toHaveCount(0);
  await page.getByRole("button", { name: "啟用音效", exact: true }).click();
  await expect.poll(async () => Number(await page.locator("html").getAttribute("data-engine-pitch"))).toBeGreaterThan(50);
  await page.keyboard.down("KeyW");
  await expect.poll(async () => Number(await page.locator("html").getAttribute("data-engine-pitch"))).toBeGreaterThan(100);
  await page.keyboard.up("KeyW");
  await page.getByRole("button", { name: "靜音", exact: true }).click();
  await expect.poll(async () => Number(await page.locator("html").getAttribute("data-audio-master"))).toBeLessThan(.001);
  await page.screenshot({ path: "/tmp/driving-feel-practice.png" });
  expect(errors).toEqual([]);
});

for (const trick of [false, true]) test(`Taipei practice jump ${trick ? "rewards a timed tap" : "lands safely without an automatic reward"}`, async ({ page }) => {
  test.setTimeout(145_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1&stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  const show = page.getByRole("button", { name: "選圖與賽事", exact: true });
  if (await show.isVisible()) await show.click();
  await page.getByRole("button", { name: /霓虹疊城/ }).click();
  const runtime = page.getByTestId("kart-runtime");
  await expect(runtime).toHaveAttribute("data-race-phase", "RACING");
  const driving = drivePractice(page, "taipei", 2, trick);
  try {
    await expect.poll(async () => Number(await runtime.getAttribute("data-stunt-progress")), { timeout: 110_000, intervals: [50] }).toBeGreaterThan(0);
    await page.screenshot({ path: `/tmp/driving-feel-practice-jump-${trick}.png` });
    const result = await driving;
    expect(result.peak).toBeGreaterThan(getTrackData("taipei").ramps[0].height + 2.5);
    expect(result.spin).toBe(trick ? 1 : .001); expect(result.turbo).toBe(trick ? 2 : 0);
    console.log("Taipei practice trick", trick, result);
    expect(errors).toEqual([]);
  } finally { await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await driving; }
});

test("Taipei train reward branch is physically traversable and completes a legal lap", async ({ page }) => {
  test.setTimeout(160_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await page.getByRole("button", { name: /霓虹疊城/ }).click();
  await expect(page.getByTestId("map-risk-route")).toHaveCount(1);
  await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
  const branch = getTrackData("taipei").branches[1], middle = branch.samples[Math.floor(branch.samples.length / 2)];
  await page.evaluate(({ eventName, middle }) => {
    let visited = false;
    const receive = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const player = (event.detail as RaceSnapshot).players.find(player => player.nickname === "玩家");
      if (!player) return;
      visited ||= Math.hypot(player.position[0] - middle.position[0], player.position[2] - middle.position[1], player.position[1] - middle.height - .52) < 4;
      document.documentElement.dataset.crossingVisited = String(visited);
      if (player.completedLaps >= 1) {
        window.removeEventListener(eventName, receive);
        window.setTimeout(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")), 0);
      }
    };
    window.addEventListener(eventName, receive);
  }, { eventName: TEST_SNAPSHOT_EVENT, middle });
  await page.getByTestId("start-race").click();
  await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
  const driving = driveRace(page, "玩家", "keyboard", 140_000, 0, false, "taipei", false, true, 1);
  try {
    await expect(page.locator("html")).toHaveAttribute("data-crossing-visited", "true", { timeout: 100_000 });
    await page.screenshot({ path: "/tmp/driving-feel-taipei-crossing.png" });
    expect((await driving).laps).toBeGreaterThanOrEqual(1); expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await driving;
    await page.getByRole("button", { name: "顯示 QR Code" }).click(); await page.getByRole("button", { name: "關閉房間" }).click();
  }
});

test("phone audio fits both orientations and touch drift earns authoritative turbo", async ({ browser, page: host }) => {
  test.setTimeout(65_000);
  const errors: string[] = []; host.on("pageerror", error => errors.push(error.message));
  await host.goto("/game?e2e=1");
  await host.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await host.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  const room = await host.getByTestId("room-code").textContent();
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const phone = await context.newPage(); phone.on("pageerror", error => errors.push(error.message));
  try {
    await phone.goto(`/controller/${room}?e2e=1&stats=1`);
    await phone.getByLabel("暱稱").fill("Touch Drifter");
    await phone.getByRole("button", { name: "加入房間", exact: true }).click();
    await phone.getByRole("button", { name: "準備完成", exact: true }).click();
    await host.getByTestId("start-race").click();
    await expect(host.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    await phone.getByRole("button", { name: "啟用音效", exact: true }).tap();
    await phone.evaluate(() => Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => "granted" }));
    await phone.getByRole("button", { name: "啟用傾斜", exact: true }).tap();
    await phone.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 0 })));
    const result = await phone.evaluate(() => new Promise<{ drift: number; turbo: number; driftFeedback: boolean; turboFeedback: boolean }>(resolve => {
      let charged = 0, pressed = false, driftFeedback = false, turboFeedback = false;
      const started = performance.now();
      const press = (control: string, down: boolean, pointerId: number) => document.querySelector(`[data-control="${control}"]`)?.dispatchEvent(
        new PointerEvent(down ? "pointerdown" : "pointerup", { bubbles: true, pointerId, pointerType: "touch" }));
      const timer = window.setInterval(() => {
        const data = document.querySelector<HTMLElement>('[data-testid="mobile-controller"]')?.dataset;
        if (!data) return;
        if (!pressed && Number(data.speed) > 6) { press("drift", true, 43); pressed = true; }
        window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: pressed && charged === 0 ? -.2 * 28 : 0 }));
        const banner = document.querySelector<HTMLElement>('[data-testid="item-feedback-banner"]');
        driftFeedback ||= banner?.dataset.feedbackTone === "drift" && Number(banner.dataset.feedbackTier) > 0;
        turboFeedback ||= charged > 0 && banner?.dataset.feedbackTone === "boost" && Number(banner.dataset.feedbackTier) > 0;
        charged = Math.max(charged, Number(data.driftTier));
        if (charged > 0) { press("drift", false, 43); }
        const turbo = Number(data.turboTier);
        if ((charged > 0 && Number(data.driftTier) === 0 && turbo > 0) || performance.now() - started > 12_000) {
          window.clearInterval(timer); press("drift", false, 43);
          window.dispatchEvent(new Event("blur")); resolve({ drift: charged, turbo, driftFeedback, turboFeedback });
        }
      }, 25);
      window.dispatchEvent(new Event("focus"));
    }));
    expect(result.drift).toBeGreaterThan(0); expect(result.turbo).toBe(result.drift);
    expect(result.driftFeedback).toBe(true); expect(result.turboFeedback).toBe(true);
    await phone.evaluate(() => window.dispatchEvent(new Event("blur")));
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await phone.setViewportSize(viewport);
      const audio = await phone.getByLabel("音效設定").boundingBox();
      for (const control of ["漂移", "左轉", "煞車或倒車"]) {
        const button = await phone.getByRole("button", { name: control, exact: true }).boundingBox();
        expect(audio && button && (audio.x + audio.width <= button.x || button.x + button.width <= audio.x ||
          audio.y + audio.height <= button.y || button.y + button.height <= audio.y)).toBe(true);
      }
      await phone.screenshot({ path: `/tmp/driving-feel-phone-${viewport.width}.png` });
    }
    await phone.getByRole("button", { name: "靜音", exact: true }).tap();
    expect(errors).toEqual([]);
  } finally {
    await host.getByRole("button", { name: "顯示 QR Code" }).click(); await host.getByRole("button", { name: "關閉房間" }).click();
    await context.close();
  }
});
