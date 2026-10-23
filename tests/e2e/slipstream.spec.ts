import { expect, test } from "@playwright/test";
import { driveSlipstream } from "./driveSlipstream";

for (const mode of ["keyboard", "phone portrait", "phone landscape"] as const) test(`real ${mode} following earns tail boost and displays progress`, async ({ browser, page: host }) => {
  const touch = mode !== "keyboard";
  const viewport = mode === "phone landscape" ? { width: 844, height: 390 } : { width: 390, height: 844 };
  test.setTimeout(75_000);
  const errors: string[] = [];
  host.on("pageerror", error => errors.push(error.message));
  await host.goto("/game?e2e=1&stats=1");
  await host.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await host.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  const room = await host.getByTestId("room-code").textContent();
  const context = await browser.newContext(touch ? { viewport, isMobile: true, hasTouch: true } : {});
  const guest = await context.newPage(); guest.on("pageerror", error => errors.push(error.message));
  let leading: ReturnType<typeof driveSlipstream> | undefined, following: ReturnType<typeof driveSlipstream> | undefined;
  try {
    await guest.goto(`/controller/${room}?e2e=1&stats=1`);
    await guest.getByLabel("暱稱").fill("Tail Driver");
    await guest.getByRole("button", { name: "加入房間", exact: true }).click();
    await guest.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await guest.getByRole("button", { name: "準備完成", exact: true }).click();
    await host.getByTestId("start-race").click();
    if (touch) {
      await guest.evaluate(() => Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => "granted" }));
      await guest.getByRole("button", { name: "啟用傾斜", exact: true }).tap();
      await guest.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 0 })));
    } else await guest.getByRole("button", { name: "切換鍵盤操作", exact: true }).click();
    await guest.getByRole("button", { name: "啟用音效", exact: true }).click();
    leading = driveSlipstream(host, "玩家", false);
    following = driveSlipstream(guest, "Tail Driver", true, touch);
    await expect(guest.getByTestId("slipstream-hud")).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByRole("progressbar", { name: "尾流蓄力" })).toBeVisible();
    if (touch) {
      const box = await guest.getByTestId("slipstream-hud").boundingBox();
      expect(box).not.toBeNull();
      for (const name of ["漂移", "左轉", "煞車或倒車"]) {
        const control = await guest.getByRole("button", { name, exact: true }).boundingBox();
        expect(control).not.toBeNull();
        expect(box && control && (box.x + box.width <= control.x || control.x + control.width <= box.x || box.y + box.height <= control.y || control.y + control.height <= box.y)).toBe(true);
      }
    }
    await guest.screenshot({ path: `/tmp/slipstream-${mode.replaceAll(" ", "-")}-charge.png` });
    await expect.poll(async () => Number(await guest.locator("html").getAttribute("data-tail-revision")), { timeout: 16_000, intervals: [25] }).toBeGreaterThan(0);
    await expect(guest.getByTestId("slipstream-hud")).toContainText("尾流超車！");
    await expect(guest.getByRole("button", { name: "靜音", exact: true })).toHaveAttribute("aria-pressed", "true");
    const result = await following;
    expect(result.ready).toBe(true); expect(result.charge).toBe(1); expect(result.revision).toBe(1);
    expect(result.peakBoostSpeed).toBeGreaterThan(18);
    expect(errors).toEqual([]);
  } finally {
    await host.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
    await guest.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
    await leading; await following;
    const show = host.getByRole("button", { name: "顯示 QR Code", exact: true }); if (await show.isVisible()) await show.click();
    await host.getByRole("button", { name: "關閉房間", exact: true }).click();
    await context.close();
  }
});
