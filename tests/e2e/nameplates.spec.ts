import { expect, test, type Page } from "@playwright/test";

test("player nameplates survive joins, cleanup, quality changes and scene remounts", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const monitor = (target: Page) => {
    target.on("pageerror", (error) => errors.push(error.message));
    target.on("console", (message) => {
      if (/synchronously unmount|removeChild/.test(message.text())) errors.push(message.text());
    });
  };
  monitor(page);
  await page.goto("/game?e2e=1&stats=1");
  await expect.poll(async () => Number(await page.getByTestId("render-diagnostics").getAttribute("data-triangles")), { timeout: 30_000 }).toBeGreaterThan(100);
  for (const track of ["風車花谷", "發條工坊"]) {
    await page.getByRole("button", { name: new RegExp(track) }).click();
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    await expect(page.getByTestId("room-code")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".player-nameplate")).toHaveCount(4);
    await expect(page.locator(".player-nameplate", { hasText: "玩家" })).toBeVisible();
    for (const quality of ["low", "standard", "low"]) {
      await page.getByRole("combobox", { name: "畫質" }).selectOption(quality);
      await expect(page.locator(".player-nameplate")).toHaveCount(4);
    }
    await page.reload();
    await expect(page.locator(".player-nameplate")).toHaveCount(4);
    await page.screenshot({ path: `/tmp/nameplates-${track}.png` });
    await page.getByRole("button", { name: "關閉房間", exact: true }).click();
    await expect(page.locator(".player-nameplate")).toHaveCount(0);
  }

  await page.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  const roomId = await page.getByTestId("room-code").textContent();
  const guestContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const guest = await guestContext.newPage();
  monitor(guest);
  await guest.goto(`/controller/${roomId}`);
  await guest.getByLabel("暱稱").fill("測試車手 <&>");
  await guest.getByRole("button", { name: "加入房間", exact: true }).click();
  await expect(page.locator(".player-nameplate")).toHaveCount(2);
  await expect(guest.locator(".player-nameplate")).toHaveCount(2);
  await expect(guest.locator(".player-nameplate", { hasText: "測試車手 <&>" })).toBeVisible();
  await guest.getByRole("button", { name: "離開", exact: true }).click();
  await expect(page.locator(".player-nameplate")).toHaveCount(1);
  await expect(guest.locator(".player-nameplate")).toHaveCount(0);
  await page.getByRole("button", { name: "關閉房間", exact: true }).click();
  await expect(page.locator(".player-nameplate")).toHaveCount(0);
  await guestContext.close();
  expect(errors).toEqual([]);
});
