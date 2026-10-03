import { expect, test, type Page } from "@playwright/test";
import { driveRace } from "./driveRace";

function monitor(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

for (const mode of ["keyboard", "phone"] as const) {
  test(`solo ${mode} races three CPUs with items, results, ${mode === "keyboard" ? "lobby" : "rematch"} and cleanup`, async ({ browser, page }) => {
    // Phone coverage includes a second complete race after the player leaves.
    test.setTimeout(mode === "phone" ? 180_000 : 120_000);
    const errors = monitor(page);
    await page.setViewportSize({ width: 960, height: 600 });
    await page.goto("/game?mode=bots&e2e=1");
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await page.getByRole("button", { name: mode === "keyboard" ? "單人對戰・鍵盤" : "單人對戰・手機", exact: true }).click();
    const roomId = await page.getByTestId("room-code").textContent();
    const phoneContext = mode === "phone" ? await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } }) : null;
    const phone = phoneContext ? await phoneContext.newPage() : null;
    const phoneErrors = phone ? monitor(phone) : [];
    if (phone) {
      await expect(page.getByTestId("start-race")).toBeDisabled();
      await phone.goto(`/controller/${roomId}?e2e=1`);
      await phone.getByLabel("暱稱").fill("Solo Driver");
      await phone.getByRole("button", { name: "加入房間" }).click();
      await expect(phone.getByTestId("controller-lobby").locator("li")).toHaveCount(4);
      await phone.getByRole("button", { name: "準備完成" }).click();
    }
    await expect(page.locator(".host-room-panel__players li")).toHaveCount(4);
    await expect(page.locator(".host-room-panel__players b", { hasText: "CPU" })).toHaveCount(3);
    if (mode === "keyboard") {
      await page.reload();
      await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
      await expect(page.getByTestId("room-code")).toHaveText(roomId!);
      await expect(page.getByTestId("keyboard-race-controls")).toBeVisible();
    }
    await page.getByTestId("start-race").click();
    const runtime = page.getByTestId("multiplayer-runtime");
    await expect(runtime).toHaveAttribute("data-phase", "racing");
    if (mode === "keyboard") {
      await page.reload();
      await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
      await expect(runtime).toHaveAttribute("data-phase", "racing");
      await page.getByRole("button", { name: "顯示 QR Code" }).click();
      await expect(page.getByTestId("room-code")).toHaveText(roomId!);
      await page.getByRole("button", { name: "收起 QR Code" }).click();
    }
    await expect(page.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
    await page.screenshot({ path: `/tmp/solo-${mode}-rear-start.png` });
    const player = runtime.locator("span", { hasText: phone ? "Solo Driver" : "玩家" });
    if (phone) {
      await phone.evaluate(() => Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => "granted" }));
      await phone.getByRole("button", { name: "啟用傾斜" }).click();
      await phone.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 0 })));
      await phone.getByRole("button", { name: "加速", exact: true }).dispatchEvent("pointerdown", { pointerId: 40, pointerType: "touch", button: 0 });
    } else {
      await page.keyboard.down("KeyW");
      await expect.poll(async () => Number(await player.getAttribute("data-speed"))).toBeGreaterThan(2);
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.keyboard.up("KeyW");
      const speed = Number(await player.getAttribute("data-speed"));
      await expect.poll(async () => Number(await player.getAttribute("data-speed"))).toBeLessThan(speed);
      await page.keyboard.down("KeyW");
    }
    await page.keyboard.up("KeyW");
    const result = await driveRace(phone ?? page, phone ? "Solo Driver" : "玩家", phone ? "touch" : "keyboard", 90_000);
    console.log(mode, result);
    await expect(page.getByTestId("multiplayer-results")).toBeVisible();
    await expect(player).toHaveAttribute("data-status", "finished");
    await expect(player).toHaveAttribute("data-laps", "3");
    expect(result.usedItem).toBe(true);
    await expect(runtime.locator('span[data-player-id^="cpu-"][data-status="finished"]')).toHaveCount(3);
    await page.screenshot({ path: `/tmp/solo-${mode}-results.png` });
    if (phone) await expect(phone.getByTestId("controller-result")).toBeVisible();
    if (mode === "keyboard") {
      await page.getByRole("button", { name: "返回 Lobby", exact: true }).click();
      await expect(runtime).toHaveAttribute("data-phase", "lobby");
      await expect(page.getByRole("button", { name: "收起 QR Code" })).toBeVisible();
      await expect(page.getByTestId("start-race")).toBeEnabled();
      await page.getByTestId("start-race").click();
      await expect(page.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
    } else {
      await page.getByTestId("rematch").click();
    }
    await expect(runtime).toHaveAttribute("data-phase", "countdown");
    await expect(runtime.locator('span[data-laps="0"][data-item="none"]')).toHaveCount(4);
    await page.screenshot({ path: `/tmp/solo-${mode}-rematch.png` });
    if (phone) {
      await phone.getByRole("button", { name: "離開", exact: true }).click();
      await expect(page.getByTestId("multiplayer-results")).toBeVisible({ timeout: 70_000 });
      await expect(page.getByTestId("rematch")).toBeDisabled();
      await page.getByRole("button", { name: "返回 Lobby", exact: true }).click();
      await expect(runtime).toHaveAttribute("data-phase", "lobby");
      await expect(runtime.locator("span")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
    expect(phoneErrors).toEqual([]);
    if (!phone) await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await page.getByRole("button", { name: "關閉房間" }).click();
    await expect(page.getByRole("button", { name: "單人對戰・鍵盤", exact: true })).toBeVisible();
    await phoneContext?.close();
  });
}
