import { TRACK_IDS } from "../../src/game/track/trackCatalog";
import { expect, test } from "@playwright/test";
import { driveRace } from "./driveRace";
import { getTrackData } from "../../src/game/track/trackData";
import { THEME_PARK_DISTRICTS } from "../../src/game/track/themeParks";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import type { RaceSnapshot } from "../../src/game/network/protocol";

const parks = [["forest", "森冠探險"], ["clockwork", "發條工坊"], ["volcano", "熔光火山"]] as const;
for (const [id, name] of parks) for (const shortcut of [false, true]) {
  test(`${id} drives every park district and a legal lap via ${shortcut ? "shortcut" : "main road"}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/game?e2e=1&stats=1");
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByTestId("map-shortcut")).toHaveCount(1);
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    const branch = getTrackData(id).branches[0], middle = branch.samples[Math.floor(branch.samples.length / 2)];
    const districts = THEME_PARK_DISTRICTS[id];
    await page.evaluate(({ districts, middle, eventName }) => {
      const seen: number[] = []; let branchSeen = false, lap = 0;
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const player = (event.detail as RaceSnapshot).players.find(player => player.nickname === "玩家");
        if (!player || player.status !== "racing") return;
        const fraction = player.raceFraction * player.totalLaps - player.completedLaps;
        const section = districts.findIndex(section => fraction >= section.from + .04 && fraction < section.to);
        if (section >= 0 && !seen.includes(section)) seen.push(section);
        if (Math.hypot(player.position[0] - middle.position[0], player.position[2] - middle.position[1]) < 4 && Math.abs(player.position[1] - middle.height - .52) < 1) branchSeen = true;
        lap = player.completedLaps;
        document.documentElement.dataset.themeParkEvidence = JSON.stringify({ seen, branchSeen, lap });
        if (lap >= 1) {
          window.removeEventListener(eventName, receive);
          window.setTimeout(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")), 0);
        }
      };
      window.addEventListener(eventName, receive);
    }, { districts, middle, eventName: TEST_SNAPSHOT_EVENT });
    await page.getByTestId("start-race").click();
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    const drive = driveRace(page, "玩家", "keyboard", 100_000, 0, false, id, false, shortcut);
    try {
      for (let index = 0; index < districts.length; index++) {
        await page.waitForFunction(index => {
          const data = document.documentElement.dataset.themeParkEvidence;
          return data ? (JSON.parse(data) as { seen: number[] }).seen.includes(index) : false;
        }, index, { timeout: 90_000 });
        await page.screenshot({ path: `/tmp/park-${id}-${shortcut ? "cut" : "main"}-${index}.png` });
      }
      const result = await drive;
      const evidence = await page.evaluate(() => JSON.parse(document.documentElement.dataset.themeParkEvidence ?? "{}") as { seen: number[]; branchSeen: boolean; lap: number });
      expect(evidence.seen).toHaveLength(districts.length);
      expect(evidence.lap).toBeGreaterThanOrEqual(1); expect(result.laps).toBeGreaterThanOrEqual(1);
      if (shortcut) expect(evidence.branchSeen).toBe(true);
      console.log(id, shortcut ? "shortcut" : "main", evidence, await page.getByTestId("render-diagnostics").textContent());
      expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await drive;
      await page.getByRole("button", { name: "顯示 QR Code" }).click();
      await page.getByRole("button", { name: "關閉房間" }).click();
    }
  });
}

for (const [id, name] of parks) {
  test(`${id} big jump visibly flies, spins and grants landing turbo`, async ({ page }) => {
    test.setTimeout(75_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/game?e2e=1&stats=1");
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    const flight = page.evaluate(eventName => new Promise<{ peak: number; spin: number; turbo: number }>(resolve => {
      let flying = false, peak = 0, spin = 0;
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const player = (event.detail as RaceSnapshot).players.find(player => player.nickname === "玩家");
        if (!player) return;
        if (player.stuntProgress > 0) { flying = true; peak = Math.max(peak, player.position[1]); spin = Math.max(spin, player.stuntProgress); }
        else if (flying) { window.removeEventListener(eventName, receive); resolve({ peak, spin, turbo: player.turboTier }); }
      };
      window.addEventListener(eventName, receive);
    }), TEST_SNAPSHOT_EVENT);
    await page.getByTestId("start-race").click();
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    const drive = driveRace(page, "玩家", "keyboard", 60_000, 2, false, id, false);
    try {
      const player = page.getByTestId("multiplayer-runtime").locator("span", { hasText: "玩家" });
      await expect.poll(async () => Number(await player.getAttribute("data-stunt-progress")), { timeout: 55_000, intervals: [50] }).toBeGreaterThan(.2);
      await page.screenshot({ path: `/tmp/park-${id}-big-jump.png` });
      const result = await flight;
      expect(result.peak).toBeGreaterThan(getTrackData(id).ramps[0].height + 2.5);
      expect(result.spin).toBe(1); expect(result.turbo).toBe(2); expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await drive;
      await page.getByRole("button", { name: "顯示 QR Code" }).click(); await page.getByRole("button", { name: "關閉房間" }).click();
    }
  });
}

test("track picker renders all new previews on a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  const picker = page.getByRole("group", { name: "選擇賽道" });
  await expect(picker.getByRole("button")).toHaveCount(TRACK_IDS.length);
  for (const [id, name] of parks) {
    await picker.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", id);
    await expect(page.getByTestId("course-map")).toHaveAttribute("aria-label", `${name}賽道地圖`);
    await expect(page.getByTestId("map-shortcut")).toHaveCount(1);
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    const box = await picker.getByRole("button", { name: new RegExp(name) }).boundingBox();
    if (!box) throw new Error("Missing track card");
    expect(box.x + box.width).toBeLessThanOrEqual(844);
    await page.screenshot({ path: `/tmp/new-picker-${id}.png` });
  }
  expect(errors).toEqual([]);
});
