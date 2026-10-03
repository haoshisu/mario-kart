import { expect, test } from "@playwright/test";

test("host and remote players render personal views and drive with keyboard or touch", async ({ browser, page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/game");
  await page.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  const roomId = await page.getByTestId("room-code").textContent();
  await expect(page.locator(".host-room-panel__players li")).toHaveCount(1);
  const mobileContext = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  const phone = await mobileContext.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.addInitScript(() => {
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      document.documentElement.dataset.outboundFrames = String(
        Number(document.documentElement.dataset.outboundFrames ?? 0) + 1,
      );
      send.call(this, data);
    };
  });
  await phone.goto(`/controller/${roomId}?stats=1`);
  await phone.getByLabel("暱稱").fill("Remote Driver");
  await phone.getByRole("button", { name: "選擇 sun 顏色" }).click();
  await phone.getByRole("button", { name: "加入房間", exact: true }).click();
  await expect(phone.getByTestId("player-game").locator("canvas")).toBeVisible();
  await phone.getByRole("button", { name: "準備完成", exact: true }).click();
  await page.getByTestId("start-race").click();
  await expect(page.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
  const runtime = page.getByTestId("multiplayer-runtime");
  await expect(runtime).toHaveAttribute("data-phase", "racing");
  const remote = runtime.locator("span", { hasText: "Remote Driver" });
  const host = runtime.locator("span", { hasText: "玩家" });
  await expect(phone.getByTestId("player-game")).toHaveAttribute("data-follow-player", (await remote.getAttribute("data-player-id"))!);
  await expect.poll(async () => Number(await phone.getByTestId("render-diagnostics").getAttribute("data-triangles"))).toBeGreaterThan(100);
  const controller = phone.getByTestId("mobile-controller");
  await expect(controller).toHaveAttribute("data-throttle", "1");
  await expect(phone.getByRole("button", { name: "加速", exact: true })).toHaveCount(0);
  const left = await phone.getByRole("button", { name: "左轉" }).boundingBox();
  const right = await phone.getByRole("button", { name: "右轉" }).boundingBox();
  const drift = await phone.getByRole("button", { name: "漂移" }).boundingBox();
  if (!left || !right || !drift) throw new Error("Missing touch controls");
  const session = await phone.context().newCDPSession(phone);
  const point = (box: { x: number; y: number; width: number; height: number }, id: number) =>
    ({ x: box.x + box.width / 2, y: box.y + box.height / 2, id });
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(left, 1), point(drift, 2)] });
  await expect(controller).toHaveAttribute("data-steer", "-1");
  await expect(controller).toHaveAttribute("data-drift", "true");
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(right, 1), point(drift, 2)] });
  await expect(controller).toHaveAttribute("data-steer", "1");
  await expect(controller).toHaveAttribute("data-drift", "true");
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(controller).toHaveAttribute("data-steer", "0");
  await expect(controller).toHaveAttribute("data-drift", "false");
  await phone.getByRole("button", { name: "煞車或倒車" }).dispatchEvent("pointerdown", { pointerId: 3 });
  await expect(controller).toHaveAttribute("data-throttle", "0");
  await expect(controller).toHaveAttribute("data-brake", "1");
  await phone.getByRole("button", { name: "煞車或倒車" }).dispatchEvent("pointerup", { pointerId: 3 });
  await expect(controller).toHaveAttribute("data-throttle", "1");
  await phone.getByRole("button", { name: "切換鍵盤操作" }).click();
  await expect(controller).toHaveAttribute("data-throttle", "0");
  await page.keyboard.down("KeyW");
  await expect.poll(async () => Number(await host.getAttribute("data-speed"))).toBeGreaterThan(2);
  await page.keyboard.up("KeyW");
  // Switching to keyboard clears auto acceleration and must not inherit host input.
  await expect.poll(async () => Math.abs(Number(await remote.getAttribute("data-speed"))), { timeout: 10_000 }).toBeLessThan(.05);
  await expect(page.locator(".game-canvas")).toHaveAttribute("data-follow-player", (await host.getAttribute("data-player-id"))!);
  await phone.keyboard.down("KeyW");
  await expect(phone.getByTestId("mobile-controller")).toHaveAttribute("data-throttle", "1");
  await expect.poll(async () => Number(await remote.getAttribute("data-speed"))).toBeGreaterThan(2);
  const sent = await phone.evaluate(async () => {
    const before = Number(document.documentElement.dataset.outboundFrames);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    return Number(document.documentElement.dataset.outboundFrames) - before;
  });
  // One 20 Hz heartbeat plus occasional RTT/heartbeat control messages.
  // A second input timer drives the coalescer near its 35 ms maximum rate.
  expect(sent).toBeGreaterThan(25);
  expect(sent).toBeLessThanOrEqual(45);
  await phone.getByRole("button", { name: "切換觸控操作" }).click();
  await expect(phone.getByTestId("mobile-controller")).toHaveAttribute("data-throttle", "1");
  await phone.keyboard.up("KeyW");

  await expect.poll(async () => Number(await remote.getAttribute("data-speed"))).toBeGreaterThan(2);
  await phone.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(phone.getByTestId("mobile-controller")).toHaveAttribute("data-throttle", "0");
  await phone.waitForTimeout(150);
  await expect(controller).toHaveAttribute("data-throttle", "0");
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await phone.setViewportSize(viewport);
    await expect(phone.getByRole("button", { name: "漂移", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(phone.getByTestId("use-item")).toBeInViewport({ ratio: 1 });
    await expect(phone.getByTestId("player-game").locator("canvas")).toBeInViewport({ ratio: 1 });
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await phone.screenshot({ path: `/tmp/personal-race-${viewport.width}.png` });
  }
  const playerId = await remote.getAttribute("data-player-id");
  await phone.reload();
  await expect(phone.getByTestId("player-game")).toHaveAttribute("data-follow-player", playerId!);
  await page.screenshot({ path: "/tmp/personal-race-host.png" });
  await page.getByRole("button", { name: "顯示 QR Code" }).click();
  await page.getByRole("button", { name: "關閉房間" }).click();
  await expect(phone.getByRole("button", { name: "加入房間", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await mobileContext.close();
});

test("phone host can use on-screen driving controls", async ({ browser, page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/game");
  await page.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  const roomId = await page.getByTestId("room-code").textContent();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/controller/${roomId}`);
  await guest.getByLabel("暱稱").fill("Guest");
  await guest.getByRole("button", { name: "加入房間", exact: true }).click();
  await guest.getByRole("button", { name: "準備完成", exact: true }).click();
  await page.getByTestId("start-race").click();
  await expect(page.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
  await page.getByRole("button", { name: "切換觸控操作" }).click();
  await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
  const gas = page.getByRole("button", { name: "漂移", exact: true });
  await expect(gas).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("use-item")).toBeInViewport({ ratio: 1 });
  const box = await gas.boundingBox();
  if (!box) throw new Error("Missing drift control");
  const quality = await page.locator(".render-settings").boundingBox();
  expect(quality && (box.x + box.width <= quality.x || quality.x + quality.width <= box.x ||
    box.y + box.height <= quality.y || quality.y + quality.height <= box.y)).toBe(true);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(async () => Number(await page.getByTestId("multiplayer-runtime").locator("span", { hasText: "玩家" }).getAttribute("data-speed"))).toBeGreaterThan(2);
  await page.mouse.up();
  await page.screenshot({ path: "/tmp/personal-race-phone-host.png" });
  await page.getByRole("button", { name: "顯示 QR Code" }).click();
  await page.getByRole("button", { name: "關閉房間" }).click();
  await guestContext.close();
});
