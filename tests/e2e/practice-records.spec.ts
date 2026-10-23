import { expect, test, type Page } from "@playwright/test";
import { practiceRecordKey } from "../../src/game/core/race/practiceRecords";
const key = practiceRecordKey("meadow");
async function ready(page: Page) {
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 20_000 });
}
// Existing diagnostic checkpoint trajectory: tests persistence/UI, not driving times or track balance.
async function finish(page: Page) {
  for (let crossing = 0; crossing < 12; crossing++) {
    await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-advance")));
    await page.waitForTimeout(35);
  }
  await expect(page.getByTestId("practice-record-result")).toBeVisible();
}
test("practice records persist, compare slower attempts and stay isolated by track", async ({ page }) => {
  test.setTimeout(75_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await ready(page);
  await expect(page.getByTestId("practice-record-target")).toContainText("建立第一筆紀錄");
  await finish(page);
  await expect(page.getByTestId("practice-record-result")).toContainText("首次完成");
  const stored = await page.evaluate(key => localStorage.getItem(key), key);
  expect(stored).not.toBeNull();
  await page.screenshot({ path: "/tmp/practice-record-first.png" });
  await page.reload(); await ready(page);
  await expect(page.getByTestId("practice-record-target")).toContainText("挑戰本機最佳");
  // A known faster target makes the slower-result comparison deterministic.
  await page.evaluate(key => localStorage.setItem(key, '{"bestTotal":0.03,"bestLap":0.01}'), key);
  await finish(page);
  await expect(page.getByTestId("practice-record-delta")).toContainText("比最佳慢");
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{"bestTotal":0.03,"bestLap":0.01}');
  expect(await page.evaluate(key => localStorage.getItem(key), practiceRecordKey("tainan"))).toBeNull();
  await page.getByRole("button", { name: "重新比賽", exact: true }).click();
  await expect(page.getByTestId("practice-record-result")).toHaveCount(0);
  await ready(page);
  await page.getByRole("button", { name: "選圖與賽事", exact: true }).click();
  await page.getByRole("button", { name: /府城暖巷/ }).click();
  await ready(page);
  await expect(page.getByTestId("practice-record-target")).toContainText("建立第一筆紀錄");
  expect(errors).toEqual([]);
});
test("new records show improvements and fit a narrow screen", async ({ page }) => {
  test.setTimeout(50_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/game?mode=solo&e2e=1");
  await page.evaluate(key => localStorage.setItem(key, '{"bestTotal":600,"bestLap":200}'), key);
  await page.reload(); await ready(page);
  await page.screenshot({ path: "/tmp/practice-record-mobile-target.png" });
  await finish(page);
  await expect(page.getByTestId("practice-record-result")).toContainText("刷新三圈紀錄");
  await expect(page.getByTestId("practice-record-delta")).toContainText("比原紀錄快");
  await page.screenshot({ path: "/tmp/practice-record-mobile-finish.png" });
  await page.getByRole("button", { name: "重新比賽", exact: true }).click();
  await expect(page.getByTestId("finish-screen")).toHaveCount(0);
});
test("blocked storage keeps practice playable and explains persistence failure", async ({ page }) => {
  test.setTimeout(50_000);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("kart-lab:practice:")) throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/game?mode=solo&e2e=1"); await ready(page); await finish(page);
  await expect(page.getByTestId("practice-record-result")).toContainText("本次結果不會保留");
  await page.getByRole("button", { name: "重新比賽", exact: true }).click();
  await ready(page);
});
