import { expect, test, type Page } from "@playwright/test";

function monitorBrowserErrors(page: Page, errors: string[] = []) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("host creates a QR room and a separate phone context drives, drops, and reconnects", async ({
  browser,
  page: hostPage,
}) => {
  test.setTimeout(40_000);
  const hostErrors = monitorBrowserErrors(hostPage);
  await hostPage.goto("/game");
  await expect(hostPage.locator("canvas")).toBeVisible();
  await expect
    .poll(() => hostPage.getByTestId("kart-runtime").getAttribute("data-race-phase"), {
      timeout: 20_000,
    })
    .toBe("RACING");

  await hostPage.getByRole("button", { name: "建立手機控制房間" }).click();
  const roomCode = hostPage.getByTestId("room-code");
  await expect(roomCode).toBeVisible();
  const roomId = (await roomCode.textContent()) ?? "";
  expect(roomId).toMatch(/^[A-Za-z0-9_-]{9}$/);
  await expect(hostPage.getByAltText("手機控制器連結 QR Code")).toHaveAttribute(
    "src",
    /^data:image\/gif;base64,/,
  );

  const phoneContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const phonePage = await phoneContext.newPage();
  const phoneErrors = monitorBrowserErrors(phonePage);
  await phonePage.goto(`/controller/${roomId}`);
  await phonePage.getByLabel("暱稱").fill("Pocket Driver");
  await phonePage.getByRole("button", { name: "加入房間" }).click();
  await expect(phonePage.getByTestId("mobile-controller")).toBeVisible();
  await expect(hostPage.getByTestId("controller-status")).toHaveText("Pocket Driver 已連線");

  const secondPhoneContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const secondPhonePage = await secondPhoneContext.newPage();
  await secondPhonePage.goto(`/controller/${roomId}`);
  await secondPhonePage.getByLabel("暱稱").fill("Extra Driver");
  await secondPhonePage.getByRole("button", { name: "加入房間" }).click();
  await expect(secondPhonePage.locator(".controller-error")).toHaveText(
    "房間已有控制器，無法加入。",
  );
  await secondPhoneContext.close();

  await phonePage.evaluate(() => {
    Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", {
      configurable: true,
      value: async () => "denied",
    });
  });
  await phonePage.getByRole("button", { name: "啟用傾斜" }).click();
  await expect(phonePage.locator(".controller-toast")).toContainText(
    "方向感測器權限遭拒",
  );

  await phonePage.setViewportSize({ width: 844, height: 390 });
  await expect(phonePage.getByRole("button", { name: "左轉" })).toBeInViewport();
  await expect(phonePage.getByRole("button", { name: "右轉" })).toBeInViewport();
  await expect(phonePage.getByRole("button", { name: "漂移" })).toBeInViewport();
  await expect(phonePage.getByRole("button", { name: "煞車或倒車" })).toBeInViewport();
  await expect(phonePage.getByRole("button", { name: "加速" })).toBeInViewport();

  const gas = phonePage.getByRole("button", { name: "加速" });
  await gas.dispatchEvent("pointerdown", {
    button: 0,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });
  await expect
    .poll(async () => Number(await hostPage.getByTestId("kart-runtime").getAttribute("data-speed")))
    .toBeGreaterThan(3);
  await expect(hostPage.getByTestId("latency-value")).toHaveText(
    /控制回饋 RTT \d+ ms/,
  );

  const startingYaw = Number(
    await hostPage.getByTestId("kart-runtime").getAttribute("data-yaw"),
  );
  const left = phonePage.getByRole("button", { name: "左轉" });
  await left.dispatchEvent("pointerdown", {
    button: 0,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });
  await expect
    .poll(async () => {
      const yaw = Number(
        await hostPage.getByTestId("kart-runtime").getAttribute("data-yaw"),
      );
      return Math.abs(Math.atan2(Math.sin(yaw - startingYaw), Math.cos(yaw - startingYaw)));
    })
    .toBeGreaterThan(0.08);
  await left.dispatchEvent("pointerup", {
    button: 0,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });

  await phoneContext.setOffline(true);
  await phonePage.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(hostPage.getByTestId("controller-status")).toHaveText(
    "手機重連中，輸入已歸零",
    { timeout: 8_000 },
  );

  await phoneContext.setOffline(false);
  await expect(phonePage.getByTestId("mobile-controller")).toBeVisible({ timeout: 6_000 });
  await expect(hostPage.getByTestId("controller-status")).toHaveText("Pocket Driver 已連線", {
    timeout: 8_000,
  });

  await hostPage.getByRole("button", { name: "關閉房間" }).click();
  await expect(phonePage.locator(".controller-error")).toHaveText("Host 已關閉房間。");
  expect(hostErrors).toEqual([]);
  expect(phoneErrors.filter((message) => !message.includes("ERR_INTERNET_DISCONNECTED"))).toEqual([]);
  await phoneContext.close();
});

test("controller shows a clear error for a nonexistent room", async ({ page }) => {
  await page.goto("/controller/not-found");
  await page.getByLabel("暱稱").fill("Lost Driver");
  await page.getByRole("button", { name: "加入房間" }).click();
  await expect(page.locator(".controller-error")).toContainText(/找不到房間|連線失敗/);
});
