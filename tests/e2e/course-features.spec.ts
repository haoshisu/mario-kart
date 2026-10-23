import { expect, test } from "@playwright/test";
import { TRACK_IDS, TRACK_CATALOG } from "../../src/game/track/trackCatalog";
import { COURSE_MECHANICS } from "../../src/game/track/courseDesign";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { driveRace } from "./driveRace";

for (const id of TRACK_IDS) {
  test(`${id} visibly drives its theme surface and finishes a legal lap`, async ({ page }) => {
    const city = id === "tainan" || id === "taichung";
    test.setTimeout(city ? 160_000 : 120_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/game?e2e=1&stats=1");
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await page.getByRole("button", { name: new RegExp(TRACK_CATALOG[id].name) }).click();
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    await page.evaluate(({ eventName, from, to }) => {
      let reached = false, lap = 0;
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const player = (event.detail as RaceSnapshot).players.find(player => player.nickname === "玩家");
        if (!player || player.status !== "racing") return;
        const progress = player.raceFraction * player.totalLaps - player.completedLaps;
        reached ||= progress >= from + .012 && progress < to;
        lap = player.completedLaps;
        document.documentElement.dataset.courseFeatureEvidence = JSON.stringify({ reached, lap });
        if (lap >= 1) {
          window.removeEventListener(eventName, receive);
          window.setTimeout(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")), 0);
        }
      };
      window.addEventListener(eventName, receive);
    }, { eventName: TEST_SNAPSHOT_EVENT, ...COURSE_MECHANICS[id] });
    await page.getByTestId("start-race").click();
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    const drive = driveRace(page, "玩家", "keyboard", city ? 140_000 : 100_000, -1.5, false, id, false);
    try {
      await page.waitForFunction(() => JSON.parse(document.documentElement.dataset.courseFeatureEvidence ?? "{}").reached === true, undefined, { timeout: 80_000 });
      await page.screenshot({ path: `/tmp/course-feature-${id}.png` });
      const result = await drive;
      expect(result.laps).toBeGreaterThanOrEqual(1);
      expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await drive;
      await page.getByRole("button", { name: "顯示 QR Code" }).click();
      await page.getByRole("button", { name: "關閉房間" }).click();
    }
  });
}
