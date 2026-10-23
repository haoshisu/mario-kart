import { expect, test } from "@playwright/test";
import { driveRace } from "./driveRace";
import { getTrackData } from "../../src/game/track/trackData";
import { THEME_PARK_DISTRICTS } from "../../src/game/track/themeParks";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import type { RaceSnapshot } from "../../src/game/network/protocol";

const parks = [["tainan", "府城暖巷"], ["taichung", "綠園光廊"]] as const;
for (const [id, name] of parks) for (const shortcut of [false]) {
  test(`${id} drives every park district and a legal lap via ${shortcut ? "shortcut" : "main road"}`, async ({ page }) => {
    test.setTimeout(160_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
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
    await page.evaluate(() => {
      let triangles = 0, calls = 0;
      const timer = window.setInterval(() => {
        const diagnostics = document.querySelector<HTMLElement>('[data-testid="render-diagnostics"]');
        triangles = Math.max(triangles, Number(diagnostics?.dataset.triangles) || 0);
        calls = Math.max(calls, Number(diagnostics?.dataset.calls) || 0);
        document.documentElement.dataset.taiwanPeakRender = JSON.stringify({ triangles, calls });
      }, 1000);
      window.addEventListener("kart-race-test-stop-drive", () => window.clearInterval(timer), { once: true });
    });
    const drive = driveRace(page, "玩家", "keyboard", 140_000, 0, false, id, false, shortcut);
    try {
      for (let index = 0; index < districts.length; index++) {
        await page.waitForFunction(index => {
          const data = document.documentElement.dataset.themeParkEvidence;
          return data ? (JSON.parse(data) as { seen: number[] }).seen.includes(index) : false;
        }, index, { timeout: 125_000 });
        await page.screenshot({ path: `doc/images/${id}-world/district-${index}.png` });
      }
      const result = await drive;
      const evidence = await page.evaluate(() => JSON.parse(document.documentElement.dataset.themeParkEvidence ?? "{}") as { seen: number[]; branchSeen: boolean; lap: number });
      const peak = await page.evaluate(() => JSON.parse(document.documentElement.dataset.taiwanPeakRender ?? "{}") as { triangles: number });
      expect(peak.triangles).toBeLessThanOrEqual(200000);
      expect(evidence.seen).toHaveLength(districts.length);
      expect(evidence.lap).toBeGreaterThanOrEqual(1); expect(result.laps).toBeGreaterThanOrEqual(1);
      if (shortcut) expect(evidence.branchSeen).toBe(true);
      console.log(id, shortcut ? "shortcut" : "main", evidence, "peak", await page.evaluate(() => document.documentElement.dataset.taiwanPeakRender), await page.getByTestId("render-diagnostics").textContent());
      expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await drive;
      await page.getByRole("button", { name: "顯示 QR Code" }).click();
      await page.getByRole("button", { name: "關閉房間" }).click();
    }
  });
}
