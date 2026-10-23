import { expect, test, type Page } from "@playwright/test";
import { TRACK_IDS } from "../../src/game/track/trackCatalog";
import { practiceRecordKey } from "../../src/game/core/race/practiceRecords";
async function openPicker(page: Page) {
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 25_000 });
  await page.getByRole("button", { name: "選圖與賽事", exact: true }).click();
  await expect(page.getByTestId("practice-tour")).toBeVisible();
  await expect(page.getByTestId("countdown-cue")).toHaveCount(0);
  await expect(page.locator(".scene-loading")).toHaveCount(0, { timeout: 20_000 });
}
test("empty tour suggests Taiwan and selecting the next stop changes the practice track", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1"); await openPicker(page);
  await expect(page.getByTestId("all-tour-count")).toHaveText("0 / 13");
  await expect(page.getByTestId("taiwan-tour-count")).toHaveText("0 / 6");
  await expect(page.getByTestId("track-record-meadow")).toHaveText("待挑戰");
  await page.getByTestId("tour-next-track").click();
  await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", "taipei");
  await openPicker(page);
  await expect(page.getByTestId("selected-practice-record")).toContainText("尚未完成三圈");
  await page.screenshot({ path: "/tmp/practice-tour-next.png" });
  expect(errors).toEqual([]);
});
test("finishing the last stop updates the tour, persists and follows cross-tab removal", async ({ page, context }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1");
  await page.evaluate(keys => keys.forEach(key => localStorage.setItem(key, '{"bestTotal":120,"bestLap":38}')),
    TRACK_IDS.filter(id => id !== "meadow").map(practiceRecordKey));
  await page.reload(); await openPicker(page);
  await expect(page.getByTestId("all-tour-count")).toHaveText("12 / 13");
  await expect(page.getByTestId("practice-tour")).toContainText("台灣六站巡遊達成");
  await page.getByRole("button", { name: "返回駕駛", exact: true }).click();
  // Diagnostic checkpoint traversal verifies progress UI, not realistic driving times.
  for (let crossing = 0; crossing < 12; crossing++) {
    await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-advance")));
    await page.waitForTimeout(35);
  }
  await expect(page.getByTestId("practice-tour")).toContainText("全圖巡遊達成");
  await expect(page.getByTestId("all-tour-count")).toHaveText("13 / 13");
  await page.getByRole("button", { name: "重新比賽", exact: true }).click();
  await openPicker(page);
  await page.screenshot({ path: "/tmp/practice-tour-complete.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await openPicker(page);
  await expect(page.getByTestId("all-tour-count")).toHaveText("13 / 13");
  await expect(page.getByTestId("tour-next-track")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/practice-tour-mobile.png" });
  const other = await context.newPage(); await other.goto("/");
  await other.evaluate(key => localStorage.removeItem(key), practiceRecordKey("taichung"));
  await expect(page.getByTestId("all-tour-count")).toHaveText("12 / 13");
  await expect(page.getByTestId("taiwan-tour-count")).toHaveText("5 / 6");
  await expect(page.getByTestId("tour-next-track")).toContainText("綠園光廊");
  await other.close(); expect(errors).toEqual([]);
});
test("unavailable records allow selection and multiplayer does not show practice progress", async ({ page }) => {
  test.setTimeout(55_000);
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key.startsWith("kart-lab:practice:")) throw new DOMException("Denied", "SecurityError");
      return original.call(this, key);
    };
  });
  await page.goto("/game?mode=solo&e2e=1"); await openPicker(page);
  await expect(page.getByTestId("practice-tour")).toContainText("無法讀取本機進度");
  await expect(page.getByTestId("all-tour-count")).toHaveCount(0);
  await page.getByRole("button", { name: /府城暖巷/ }).click();
  await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", "tainan");
  await page.goto("/game");
  await expect(page.getByTestId("host-room-panel")).toBeVisible();
  await expect(page.getByTestId("practice-tour")).toHaveCount(0);
});
