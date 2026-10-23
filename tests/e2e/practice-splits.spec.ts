import { expect, test, type Page } from "@playwright/test";
import { practiceRecordKey, parsePracticeRecord } from "../../src/game/core/race/practiceRecords";
import { formatRaceTime } from "../../src/game/components/RaceHud";
const key = practiceRecordKey("meadow");
async function ready(page: Page) {
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 20_000 });
  await expect(page.getByTestId("countdown-cue")).toHaveCount(0);
}
// Diagnostic checkpoint trajectory tests comparison/UI; these are not realistic lap times.
async function lap(page: Page) {
  for (let crossing = 0; crossing < 4; crossing++) {
    await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-advance")));
    await page.waitForTimeout(40);
  }
}
test("lap splits show behind then ahead, keep the starting reference, and reset on rematch", async ({ page }) => {
  test.setTimeout(70_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, '{"bestTotal":400.01,"bestLap":0.01,"bestRunLaps":[0.01,200,200]}');
  }, key);
  await page.goto("/game?mode=solo&e2e=1"); await ready(page);
  await expect(page.getByTestId("practice-next-lap")).toContainText("第 1 圈目標 0:00.01");
  await expect(page.getByTestId("practice-live-split")).toHaveCount(0);
  await lap(page);
  await expect(page.getByTestId("practice-live-split")).toContainText("第 1 圈完成 · 累計慢");
  await expect(page.getByTestId("practice-next-lap")).toContainText("第 2 圈目標 3:20.00");
  await lap(page);
  await expect(page.getByTestId("practice-live-split")).toContainText("第 2 圈完成 · 累計快");
  await page.screenshot({ path: "/tmp/practice-splits-driving.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await lap(page);
  await expect(page.getByTestId("practice-record-result")).toContainText("刷新三圈紀錄");
  await expect(page.getByTestId("practice-split-1")).toContainText("慢");
  await expect(page.getByTestId("practice-split-3")).toContainText("快");
  const stored = parsePracticeRecord(await page.evaluate(key => localStorage.getItem(key), key));
  expect(stored?.bestRunLaps).toHaveLength(3);
  const firstLap = stored?.bestRunLaps?.[0];
  if (firstLap === undefined) throw new Error("Missing persisted reference laps");
  await page.screenshot({ path: "/tmp/practice-splits-mobile-result.png" });
  await page.getByRole("button", { name: "重新比賽", exact: true }).click(); await ready(page);
  await expect(page.getByTestId("practice-live-split")).toHaveCount(0);
  await expect(page.getByTestId("practice-next-lap")).toContainText(`第 1 圈目標 ${formatRaceTime(firstLap)}`);
  await page.reload(); await ready(page);
  await expect(page.getByTestId("practice-next-lap")).toContainText(`第 1 圈目標 ${formatRaceTime(firstLap)}`);
  expect(errors).toEqual([]);
});
test("legacy records retain totals and gain reference laps after an improvement", async ({ page }) => {
  test.setTimeout(50_000);
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, '{"bestTotal":600,"bestLap":200}');
  }, key);
  await page.goto("/game?mode=solo&e2e=1"); await ready(page);
  await expect(page.getByTestId("practice-record-target")).toContainText("刷新或追平總時間，建立逐圈對照");
  await expect(page.getByTestId("practice-best-total")).toHaveText("10:00.00");
  await lap(page); await lap(page); await lap(page);
  await expect(page.getByTestId("practice-record-result")).toContainText("此場起跑前尚無逐圈資料");
  expect(parsePracticeRecord(await page.evaluate(key => localStorage.getItem(key), key))?.bestRunLaps).toHaveLength(3);
  await page.getByRole("button", { name: "重新比賽", exact: true }).click(); await ready(page);
  await expect(page.getByTestId("practice-next-lap")).toContainText("第 1 圈目標");
});
