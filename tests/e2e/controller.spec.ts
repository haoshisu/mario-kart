import { expect, test, type Browser, type Page } from "@playwright/test";
import { driveRace } from "./driveRace";
import { PLAYER_COLORS } from "../../src/game/network/networkConfig";
import { ITEM_KINDS, ITEM_LABELS } from "../../src/game/core/items/itemConfig";

function monitorBrowserErrors(page: Page, errors: string[] = []) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("phone picks up and uses an authoritative item without steering and fits both orientations", async ({ browser, page: hostPage }) => {
  test.setTimeout(75_000);
  const hostErrors = monitorBrowserErrors(hostPage);
  await hostPage.addInitScript(() => {
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      document.documentElement.dataset.audioVoices = String(Number(document.documentElement.dataset.audioVoices ?? 0) + 1);
      return createOscillator.call(this);
    };
  });
  const roomId = await createRoom(hostPage);
  await hostPage.getByRole("button", { name: "啟用音效" }).click();
  await expect(hostPage.getByRole("button", { name: "靜音", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => Number(await hostPage.locator("html").getAttribute("data-audio-voices"))).toBeGreaterThan(0);
  const driver = await joinPhone(browser, roomId, "Item Driver", 0);
  const other = await joinPhone(browser, roomId, "Observer", 1);
  await driver.page.getByRole("button", { name: "準備完成" }).click();
  await other.page.getByRole("button", { name: "準備完成" }).click();
  await hostPage.getByTestId("start-race").click();
  await expect(hostPage.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
  await expect(hostPage.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
  const telemetry = hostPage.getByTestId("multiplayer-runtime").locator("span", { hasText: "Item Driver" });
  await setControl(driver.page, "加速", true);
  await expect(driver.page.getByTestId("use-item")).toBeEnabled({ timeout: 6_000 });
  await setControl(driver.page, "加速", false);
  const pickedItem = await telemetry.getAttribute("data-item");
  const item = ITEM_KINDS.find((kind) => kind === pickedItem);
  if (!item) throw new Error(`Unexpected item: ${pickedItem}`);
  await expect(driver.page.getByTestId("use-item")).toHaveAttribute("aria-description", ITEM_LABELS[item]);
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await driver.page.setViewportSize(viewport);
    await expect(driver.page.getByTestId("use-item")).toBeInViewport({ ratio: 1 });
    await expect(driver.page.getByRole("button", { name: "漂移", exact: true })).toBeInViewport({ ratio: 1 });
    const itemBox = await driver.page.getByTestId("use-item").boundingBox();
    const leftBox = await driver.page.getByRole("button", { name: "左轉" }).boundingBox();
    const quality = await driver.page.locator(".player-game .render-settings").boundingBox();
    expect(itemBox && quality && (itemBox.x + itemBox.width <= quality.x || quality.x + quality.width <= itemBox.x ||
      itemBox.y + itemBox.height <= quality.y || quality.y + quality.height <= itemBox.y)).toBe(true);
    expect(await driver.page.getByTestId("controller-item-panel").textContent()).toBe("");
    expect(itemBox && leftBox && itemBox.y + itemBox.height + 8 <= leftBox.y).toBe(true);
    await driver.page.screenshot({ path: `/tmp/phase5-controller-${viewport.width}.png` });
  }
  const yaw = Number(await telemetry.getAttribute("data-yaw"));
  await driver.page.getByTestId("use-item").tap();
  await expect(telemetry).toHaveAttribute("data-item", "none");
  await expect(hostPage.locator('[data-event-kind="use"]')).toContainText("Item Driver 使用");
  await expect(driver.page.getByTestId("use-item")).toBeDisabled();
  expect(Number(await telemetry.getAttribute("data-yaw"))).toBeCloseTo(yaw, 2);
  if (item === "boost" || item === "shield") {
    await expect.poll(async () => Number(await telemetry.getAttribute(`data-item-${item}`))).toBeGreaterThan(0);
  } else if (item === "trap") {
    await expect(hostPage.getByTestId("multiplayer-runtime")).toHaveAttribute("data-traps", "1");
  }
  await hostPage.screenshot({ path: "/tmp/phase5-item-use.png" });
  await hostPage.getByRole("slider", { name: "音效音量" }).focus();
  await hostPage.getByRole("slider", { name: "音效音量" }).press("Home");
  await expect(hostPage.getByRole("slider", { name: "音效音量" })).toHaveValue("0");
  await hostPage.getByRole("button", { name: "靜音", exact: true }).click();
  await expect(hostPage.getByRole("button", { name: "啟用音效" })).toHaveAttribute("aria-pressed", "false");
  expect(hostErrors).toEqual([]);
  expect(driver.errors).toEqual([]);
  expect(other.errors).toEqual([]);
  await hostPage.getByRole("button", { name: "顯示 QR Code" }).click();
  await hostPage.getByRole("button", { name: "關閉房間" }).click();
  await driver.context.close();
  await other.context.close();
});

async function createRoom(hostPage: Page, track?: "harbor") {
  await hostPage.goto("/");
  await hostPage.getByRole("link", { name: "建立多人卡丁車賽事" }).click();
  await expect(hostPage.getByText("建立多人賽事房間，邀請 2～4 位玩家加入並準備。")).toBeVisible();
  await expect(hostPage.getByTestId("kart-runtime")).toHaveCount(0);
  await expect(hostPage.locator("canvas")).toBeVisible();
  // All simulated devices share this runner's GPU; reserve full-quality visual
  // verification for the dedicated rendering tests, not the input feedback loop.
  await hostPage.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await hostPage.evaluate(() => history.replaceState(null, "", "?e2e=1"));
  if (track === "harbor") await hostPage.getByRole("button", { name: /霓虹港都/ }).click();
  await hostPage.getByLabel("房主直接參賽").uncheck();
  await hostPage.getByRole("button", { name: "建立多人賽事房間" }).click();
  const roomCode = hostPage.getByTestId("room-code");
  await expect(roomCode).toBeVisible();
  const roomId = (await roomCode.textContent()) ?? "";
  expect(roomId).toMatch(/^[A-Za-z0-9_-]{9}$/);
  await expect(hostPage.getByAltText("手機控制器連結 QR Code")).toHaveAttribute(
    "src",
    /^data:image\/gif;base64,/,
  );
  await expect(hostPage.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "lobby");
  await expect(hostPage.getByTestId("start-race")).toBeDisabled();
  return roomId;
}

async function joinPhone(
  browser: Browser,
  roomId: string,
  nickname: string,
  colorIndex: number,
) {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = monitorBrowserErrors(page);
  await page.goto(`/controller/${roomId}?e2e=1`);
  await page.getByLabel("暱稱").fill(nickname);
  await page.getByRole("button", { name: `選擇 ${PLAYER_COLORS[colorIndex]} 顏色` }).click();
  await page.getByRole("button", { name: "加入房間" }).click();
  await expect(page.getByTestId("controller-lobby")).toBeVisible();
  return { context, page, errors };
}

async function setControl(page: Page, name: "加速" | "左轉" | "右轉" | "漂移", pressed: boolean) {
  if (name === "加速") {
    await page.evaluate(active => window.dispatchEvent(new Event(active ? "focus" : "blur")), pressed);
    return;
  }
  await page.getByRole("button", { name }).dispatchEvent(pressed ? "pointerdown" : "pointerup", {
    button: 0,
    isPrimary: true,
    pointerId: name === "左轉" ? 41 : name === "右轉" ? 42 : 43,
    pointerType: "touch",
  });
}

async function driveFourPlayers(
  hostPage: Page,
  phones: readonly { page: Page; nickname: string }[],
  durationMs = 12_000,
  useItems = false,
) {
  // Long simulations share one GPU across up to five devices. Keep rendering
  // active at a small canvas size; independent-players.spec covers full screens.
  const renderLimits = durationMs > 20_000 ? await Promise.all(phones.map(({ page }) =>
    page.addStyleTag({ content: ".player-game { width: 160px; height: 240px; }" }))) : [];
  // Keep the test driver on each device: serial automation round trips across
  // several 3D pages add artificial steering latency that real players do not have.
  await Promise.all(phones.map(async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", {
        configurable: true, value: async () => "granted",
      });
    });
    await page.getByRole("button", { name: "啟用傾斜" }).click();
  }));
  const results = await Promise.all(phones.map(async ({ page, nickname }, index) => {
    const result = await driveRace(page, nickname, "touch", durationMs, index - (phones.length - 1) / 2, useItems);
    console.log(nickname, result);
    expect(result.kartSpins).toBe(0);
    return { nickname, used: result.usedItem };
  }));
  await Promise.all(renderLimits.map((style) => style.evaluate((element) => element.parentNode?.removeChild(element))));
  await expect(hostPage.getByTestId("multiplayer-runtime")).toBeAttached();
  return new Set(results.filter((result) => result.used).map((result) => result.nickname));
}

for (const playerCount of [2, 3, 4]) {
  test(`${playerCount} racers drive three laps with items and rematch in the same room`, async ({ browser, page: hostPage }) => {
    test.setTimeout(160_000);
    const hostErrors = monitorBrowserErrors(hostPage);
    await hostPage.setViewportSize({ width: 960, height: 600 });
    const roomId = await createRoom(hostPage);
    const phones: Awaited<ReturnType<typeof joinPhone>>[] = [];
    for (let index = 0; index < playerCount; index += 1) {
      phones.push(await joinPhone(browser, roomId, `Racer ${index + 1}`, index));
    }
    await Promise.all(phones.map(({ page }) => page.getByRole("button", { name: "準備完成" }).click()));
    await hostPage.getByTestId("start-race").click();
    const runtime = hostPage.getByTestId("multiplayer-runtime");
    await expect(runtime).toHaveAttribute("data-phase", "racing");
    await expect(hostPage.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
    const usedItems = await driveFourPlayers(hostPage, phones.map(({ page }, index) => ({ page, nickname: `Racer ${index + 1}` })), 125_000, true);
    await expect(hostPage.getByTestId("multiplayer-results")).toBeVisible();
    expect(usedItems.size).toBe(playerCount);
    const normalizeRanking = (rows: string[]) => rows.map((row) => row.replace(/[\s·]/g, ""));
    const hostRanking = normalizeRanking(await hostPage.getByTestId("multiplayer-results").locator("li").allTextContents());
    for (let index = 0; index < playerCount; index += 1) {
      const player = runtime.locator("span", { hasText: `Racer ${index + 1}` });
      await expect(player).toHaveAttribute("data-status", "finished");
      await expect(player).toHaveAttribute("data-laps", "3");
      await expect(phones[index].page.getByTestId("controller-result")).toBeVisible();
      await expect.poll(async () => normalizeRanking(await phones[index].page.locator(".controller-result-ranking li").allTextContents())).toEqual(hostRanking);
      expect(phones[index].errors).toEqual([]);
    }
    await hostPage.screenshot({ path: `/tmp/phase5-${playerCount}-results.png` });
    await hostPage.getByTestId("rematch").click();
    await expect(runtime).toHaveAttribute("data-phase", "countdown");
    for (const { page } of phones) await expect(page.getByTestId("controller-countdown")).toBeVisible();
    await expect(runtime.locator('span[data-laps="0"][data-item="none"]')).toHaveCount(playerCount);
    await hostPage.getByRole("button", { name: "顯示 QR Code" }).click();
    await expect(hostPage.getByTestId("room-code")).toHaveText(roomId);
    expect(hostErrors).toEqual([]);
    await hostPage.getByRole("button", { name: "關閉房間" }).click();
    await Promise.all(phones.map(({ context }) => context.close()));
  });
}

test("multiplayer drift renders bounded smoke and sparks and releases turbo", async ({ browser, page: hostPage }) => {
  test.setTimeout(60_000);
  const hostErrors = monitorBrowserErrors(hostPage);
  const roomId = await createRoom(hostPage, "harbor");
  const driver = await joinPhone(browser, roomId, "Drifter", 0);
  const observer = await joinPhone(browser, roomId, "Observer", 1);
  await driver.page.getByRole("button", { name: "準備完成" }).click();
  await observer.page.getByRole("button", { name: "準備完成" }).click();
  await hostPage.getByTestId("start-race").click();
  await expect(hostPage.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
  await expect(hostPage.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
  const player = hostPage.getByTestId("multiplayer-runtime").locator("span", { hasText: "Drifter" });
  await driver.page.evaluate(() => {
    Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => "granted" });
  });
  await driver.page.getByRole("button", { name: "啟用傾斜" }).click();
  await driver.page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 0 })));
  const observed = await driver.page.evaluate(() => new Promise<{ drift: number; turbo: number; maxSteer: number }>((resolve) => {
    let drifting = false, drift = 0, turbo = 0, maxSteer = 0;
    const tilt = (steer: number) => {
      const angle = ((window.screen.orientation?.angle ?? 0) + 360) % 360;
      window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", {
        beta: angle === 90 ? steer * 28 : angle === 270 ? -steer * 28 : 0,
        gamma: angle === 0 ? steer * 28 : angle === 180 ? -steer * 28 : 0,
      }));
    };
    tilt(0);
    const deadline = performance.now() + 8_000;
    const press = (control: string, pressed: boolean, pointerId: number) => {
      document.querySelector(`[data-control="${control}"]`)?.dispatchEvent(new PointerEvent(pressed ? "pointerdown" : "pointerup", {
        bubbles: true, pointerId, pointerType: "touch",
      }));
    };
    window.dispatchEvent(new Event("focus"));
    const timer = window.setInterval(() => {
      const data = document.querySelector<HTMLElement>('[data-testid="mobile-controller"]')?.dataset;
      if (!data) return;
      maxSteer = Math.max(maxSteer, Math.abs(Number(data.steer)));
      if (!drifting && Number(data.speed) > 8) {
        tilt(0);
        press("drift", true, 43);
        drifting = true;
      }
      // Emulate a continuous sensor stream. Chromium can emit one native null
      // sample after permission, which must not replace the entire test drive.
      if (drifting && drift === 0) tilt(.2);
      drift = Math.max(drift, Number(data.driftTier) || 0);
      if (drift > 0) {
        press("drift", false, 43);
        tilt(0);
      }
      // Only observe turbo after the charged drift has actually been released;
      // the tier-two launch effect must not satisfy this assertion.
      if (drift > 0 && Number(data.driftTier) === 0) turbo = Number(data.turboTier) || 0;
      if ((drift > 0 && turbo > 0) || performance.now() >= deadline) {
        window.clearInterval(timer);
        window.dispatchEvent(new Event("blur"));
        press("drift", false, 43);
        resolve({ drift, turbo, maxSteer });
      }
    }, 30);
  }));
  console.log("Tilt drift sample:", observed);
  expect(observed.drift).toBeGreaterThan(0);
  expect(observed.turbo).toBe(observed.drift);
  expect(observed.maxSteer).toBeGreaterThanOrEqual(.18);
  await expect(player).toHaveAttribute("data-drifting", "false");
  await hostPage.screenshot({ path: "/tmp/phase5-multiplayer-turbo.png" });
  expect(hostErrors).toEqual([]);
  expect(driver.errors).toEqual([]);
  await hostPage.getByRole("button", { name: "顯示 QR Code" }).click();
  await hostPage.getByRole("button", { name: "關閉房間" }).click();
  await driver.context.close(); await observer.context.close();
});

test("four phones complete the authoritative lobby-to-results flow", async ({
  browser,
  page: hostPage,
}) => {
  test.setTimeout(90_000);
  const hostErrors = monitorBrowserErrors(hostPage);
  const roomId = await createRoom(hostPage);
  const joined = [];
  for (let index = 0; index < 4; index += 1) {
    joined.push(await joinPhone(browser, roomId, `Driver ${index + 1}`, index));
  }
  await expect(hostPage.getByTestId("controller-status")).toHaveText("4/4 位玩家");
  await expect(hostPage.locator(".player-nameplate")).toHaveCount(4);
  const panelAboveName = await hostPage.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="host-room-panel"]');
    const label = document.querySelector<HTMLElement>(".player-nameplate");
    if (!panel || !label) return false;
    const previousStyle = panel.style.cssText;
    const rect = label.getBoundingClientRect();
    try {
      // Recreate a projected nameplate overlapping the room panel, as in the reported screenshot.
      panel.style.position = "fixed";
      panel.style.left = `${rect.left - 10}px`;
      panel.style.top = `${rect.top - 10}px`;
      panel.style.right = "auto";
      const hit = document.elementFromPoint(rect.left + 2, rect.top + 2);
      return panel.contains(hit);
    } finally {
      panel.style.cssText = previousStyle;
    }
  });
  expect(panelAboveName).toBe(true);


  const fifthContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const fifthPage = await fifthContext.newPage();
  await fifthPage.goto(`/controller/${roomId}?e2e=1`);
  await fifthPage.getByLabel("暱稱").fill("Fifth Driver");
  await fifthPage.getByRole("button", { name: "加入房間" }).click();
  await expect(fifthPage.locator(".controller-error")).toHaveText(
    "房間已滿，最多只能加入四位玩家。",
  );
  await fifthContext.close();

  await Promise.all(joined.map(({ page }) => page.getByRole("button", { name: "準備完成" }).click()));
  await expect(hostPage.getByTestId("start-race")).toBeEnabled();
  await hostPage.getByTestId("start-race").click();
  await expect.poll(
    () => hostPage.getByTestId("multiplayer-runtime").getAttribute("data-phase"),
    { timeout: 5_000 },
  ).toBe("racing");

  await Promise.all(joined.map(({ page }) => setControl(page, "加速", false)));
  const first = hostPage.getByTestId("multiplayer-runtime").locator("span", { hasText: "Driver 1" });
  const second = hostPage.getByTestId("multiplayer-runtime").locator("span", { hasText: "Driver 2" });
  for (const car of [first, second]) {
    await expect.poll(async () => Math.abs(Number(await car.getAttribute("data-speed"))),
      { timeout: 10_000 }).toBeLessThan(.05);
  }
  await setControl(joined[0].page, "加速", true);
  await expect.poll(async () => Number(await first.getAttribute("data-speed"))).toBeGreaterThan(1.5);
  expect(Math.abs(Number(await second.getAttribute("data-speed")))).toBeLessThan(0.3);
  await setControl(joined[0].page, "加速", false);

  await driveFourPlayers(
    hostPage,
    joined.map(({ page }, index) => ({ page, nickname: `Driver ${index + 1}` })),
  );
  await Promise.all(joined.map(({ page }) => page.getByRole("button", { name: "離開" }).click()));
  await expect(hostPage.getByTestId("multiplayer-results")).toBeVisible({ timeout: 5_000 });
  await expect(hostPage.getByTestId("multiplayer-results").locator("li")).toHaveCount(4);
  await expect(hostPage.getByTestId("multiplayer-results")).toContainText("DNF");
  for (const { errors } of joined) {
    expect(errors).toEqual([]);
  }
  expect(hostErrors).toEqual([]);

  await hostPage.getByRole("button", { name: "返回 Lobby" }).click();
  await expect(hostPage.getByTestId("start-race")).toBeDisabled();
  await expect(hostPage.getByTestId("controller-status")).toHaveText("0/4 位玩家");
  await hostPage.getByRole("button", { name: "關閉房間" }).click();
  await Promise.all(joined.map(({ context }) => context.close()));
});

test("three phones can ready, start, drive independently, and reach results", async ({
  browser,
  page: hostPage,
}) => {
  test.setTimeout(80_000);
  const roomId = await createRoom(hostPage);
  const joined = [];
  for (let index = 0; index < 3; index += 1) {
    joined.push(await joinPhone(browser, roomId, `Trio ${index + 1}`, index));
  }

  await Promise.all(joined.map(({ page }) => page.getByRole("button", { name: "準備完成" }).click()));
  await expect(hostPage.getByTestId("start-race")).toBeEnabled();
  await hostPage.getByTestId("start-race").click();
  await expect.poll(
    () => hostPage.getByTestId("multiplayer-runtime").getAttribute("data-phase"),
    { timeout: 5_000 },
  ).toBe("racing");
  await expect(hostPage.getByTestId("multiplayer-runtime").locator("span")).toHaveCount(3);

  await Promise.all(joined.map(({ page }) => setControl(page, "加速", false)));
  const first = hostPage.getByTestId("multiplayer-runtime").locator("span", { hasText: "Trio 1" });
  const second = hostPage.getByTestId("multiplayer-runtime").locator("span", { hasText: "Trio 2" });
  await expect.poll(async () => Math.abs(Number(await second.getAttribute("data-speed"))), { timeout: 10_000 }).toBeLessThan(.05);
  await setControl(joined[0].page, "加速", true);
  await expect.poll(async () => Number(await first.getAttribute("data-speed"))).toBeGreaterThan(1.5);
  expect(Math.abs(Number(await second.getAttribute("data-speed")))).toBeLessThan(0.3);
  await setControl(joined[0].page, "加速", false);

  await Promise.all(joined.map(({ page }) => page.getByRole("button", { name: "離開" }).click()));
  await expect(hostPage.getByTestId("multiplayer-results").locator("li")).toHaveCount(3);
  await hostPage.getByRole("button", { name: "顯示 QR Code" }).click();
  await hostPage.getByRole("button", { name: "關閉房間" }).click();
  await Promise.all(joined.map(({ context }) => context.close()));
});

test("host refresh and a phone network drop preserve the reserved multiplayer slots", async ({
  browser,
  page: hostPage,
}) => {
  test.setTimeout(75_000);
  const roomId = await createRoom(hostPage);
  const first = await joinPhone(browser, roomId, "Reconnect One", 0);
  const second = await joinPhone(browser, roomId, "Reconnect Two", 1);

  await hostPage.reload();
  await expect(hostPage.getByTestId("room-code")).toHaveText(roomId, { timeout: 8_000 });
  await expect(hostPage.getByTestId("controller-status")).toHaveText("2/4 位玩家");

  await hostPage.context().setOffline(true);
  await expect(hostPage.getByTestId("host-room-panel")).toHaveAttribute(
    "data-room-phase",
    "reconnecting",
    { timeout: 8_000 },
  );
  await hostPage.context().setOffline(false);
  await expect(hostPage.getByTestId("host-room-panel")).toHaveAttribute(
    "data-room-phase",
    "open",
    { timeout: 8_000 },
  );

  await first.context.setOffline(true);
  await expect(hostPage.getByTestId("controller-status")).toContainText("重連中", {
    timeout: 12_000,
  });
  await first.context.setOffline(false);
  await expect(first.page.getByTestId("controller-lobby")).toBeVisible({ timeout: 7_000 });
  await expect(hostPage.getByTestId("controller-status")).toHaveText("2/4 位玩家", {
    timeout: 8_000,
  });

  // The lobby remains mounted while reconnecting. Confirm a new command has
  // crossed the restored socket before simulating the next independent outage.
  await expect(first.page.locator(".controller-status-bar span")).toHaveText("CONNECTED");
  await first.page.getByRole("button", { name: "準備完成", exact: true }).click();
  await expect(hostPage.locator(".host-room-panel__players li", { hasText: "Reconnect One" }).locator("b")).toHaveText("READY");
  await first.context.setOffline(true);
  await expect(hostPage.getByTestId("controller-status")).toContainText("重連中", {
    timeout: 12_000,
  });
  await expect(hostPage.getByTestId("controller-status")).toHaveText("1/4 位玩家", {
    timeout: 12_000,
  });
  await hostPage.getByRole("button", { name: "關閉房間" }).click();
  await expect(second.page.locator(".controller-error")).toHaveText("Host 已關閉房間。");
  await first.context.close();
  await second.context.close();
});

test("controller shows a clear error for a nonexistent room", async ({ page }) => {
  await page.goto("/controller/not-found");
  await page.getByLabel("暱稱").fill("Lost Driver");
  await page.getByRole("button", { name: "加入房間" }).click();
  await expect(page.locator(".controller-error")).toContainText(/找不到房間|連線失敗/);
});

test("two separated players stay visible and throttle produces prompt visual motion", async ({ browser, page: hostPage }) => {
  test.setTimeout(60_000);
  const roomId = await createRoom(hostPage);
  const fast = await joinPhone(browser, roomId, "Fast", 0);
  const slow = await joinPhone(browser, roomId, "Slow", 1);
  // Let lobby snapshots exceed the countdown's ticks: starting must not reset the stream.
  await hostPage.waitForTimeout(6_000);
  await fast.page.getByRole("button", { name: "準備完成" }).click();
  await slow.page.getByRole("button", { name: "準備完成" }).click();
  const countdown = hostPage.evaluate(() => new Promise<number>((resolve) => {
    const runtime = document.querySelector('[data-testid="multiplayer-runtime"]');
    const start = document.querySelector<HTMLButtonElement>('[data-testid="start-race"]');
    if (!runtime || !start) { resolve(Infinity); return; }
    const started = performance.now();
    const finish = (elapsed: number) => { observer.disconnect(); window.clearTimeout(timeout); resolve(elapsed); };
    const observer = new MutationObserver(() => {
      if (runtime.getAttribute("data-phase") === "racing") finish(performance.now() - started);
    });
    const timeout = window.setTimeout(() => finish(Infinity), 6_000);
    observer.observe(runtime, { attributes: true, attributeFilter: ["data-phase"] });
    start.click();
  }));
  await expect(hostPage.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
  expect(await countdown).toBeLessThan(4_500);
  await setControl(fast.page, "加速", false);
  await setControl(slow.page, "加速", false);
  // GO now launches every kart automatically. Wait for that motion to stop so
  // launch/coasting and camera framing cannot masquerade as input response.
  const racers = hostPage.getByTestId("multiplayer-runtime").locator("span");
  for (const name of ["Fast", "Slow"]) {
    await expect.poll(async () => Math.abs(Number(await racers.filter({ hasText: name }).getAttribute("data-speed"))),
      { timeout: 10_000 }).toBeLessThan(.05);
  }
  await hostPage.waitForTimeout(500);
  // Measure rendered nameplates, not the throttled React telemetry or speed alone.
  const motion = hostPage.evaluate(() => new Promise<number>((resolve) => {
    const labels = [...document.querySelectorAll(".player-nameplate")];
    const fastLabel = labels.find((label) => label.textContent === "Fast");
    const slowLabel = labels.find((label) => label.textContent === "Slow");
    if (!fastLabel || !slowLabel) { resolve(Infinity); return; }
    const distance = () => fastLabel.getBoundingClientRect().x - slowLabel.getBoundingClientRect().x;
    const initial = distance();
    const started = performance.now();
    const check = () => {
      const elapsed = performance.now() - started;
      if (Math.abs(distance() - initial) > 0.1) resolve(Date.now());
      else if (elapsed > 2_000) resolve(Infinity);
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
  const inputAt = await fast.page.evaluate(() => {
    const started = Date.now();
    window.dispatchEvent(new Event("focus"));
    return started;
  });
  const visualLatency = (await motion) - inputAt;
  console.log(`Two-player visual input response: ${Math.round(visualLatency)} ms`);
  expect(visualLatency).toBeGreaterThanOrEqual(0);
  expect(visualLatency).toBeLessThan(350);
  await expect.poll(async () => {
    const coordinates = await racers.evaluateAll((elements) => elements.map((element) => Number(element.getAttribute("data-x"))));
    return Math.abs(coordinates[0] - coordinates[1]);
  }, { timeout: 8_000 }).toBeGreaterThan(25);
  await setControl(fast.page, "加速", false);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 600, height: 900 }]) {
    await hostPage.setViewportSize(viewport);
    for (const name of ["Fast", "Slow"]) {
      await expect(hostPage.locator(".player-nameplate", { hasText: name })).toBeInViewport({ ratio: 1 });
    }
  }
  await hostPage.screenshot({ path: "/tmp/two-player-framing.png" });
  await hostPage.getByRole("button", { name: "顯示 QR Code" }).click();
  await hostPage.getByRole("button", { name: "關閉房間" }).click();
  await fast.context.close();
  await slow.context.close();
});
