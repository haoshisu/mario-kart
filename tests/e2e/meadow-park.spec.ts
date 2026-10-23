import { expect, test } from "@playwright/test";
import { driveRace } from "./driveRace";
import { getTrackData } from "../../src/game/track/trackData";
import { MEADOW_PARK_SECTIONS } from "../../src/game/track/meadowPark";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";

for (const shortcut of [false, true]) {
  test(`drives one legal meadow park lap through six districts via ${shortcut ? "the narrow bridge shortcut" : "the main greenhouse road"}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/game?e2e=1&stats=1");
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await page.getByRole("button", { name: /風車花谷/ }).click();
    await expect(page.getByTestId("map-shortcut")).toHaveCount(1);
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    const track = getTrackData("meadow"), branch = track.branches[0];
    const middle = branch.samples[Math.floor(branch.samples.length / 2)];
    await page.evaluate(({ sections, middle, eventName }) => {
      const records: Array<{ index: number; name: string; fraction: number; position: readonly number[]; diagnostics: string }> = [];
      let uphillReached = false;
      let shortcutReached = false, completedLaps = 0, minHeight = Infinity, maxHeight = -Infinity;
      const publish = () => {
        document.documentElement.dataset.meadowParkEvidence = JSON.stringify({ records, shortcutReached, uphillReached, completedLaps, minHeight, maxHeight });
      };
      const cleanup = () => {
        window.removeEventListener(eventName, receive);
        window.removeEventListener("kart-meadow-test-stop-observe", cleanup);
      };
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const snapshot = event.detail as RaceSnapshot;
        const player = snapshot.players.find(player => player.nickname === "玩家");
        if (!player || player.status !== "racing") return;
        minHeight = Math.min(minHeight, player.position[1]);
        maxHeight = Math.max(maxHeight, player.position[1]);
        const distanceToMiddle = Math.hypot(player.position[0] - middle.position[0], player.position[2] - middle.position[1]);
        if (!shortcutReached && distanceToMiddle < 4 && Math.abs(player.position[1] - middle.height - .52) < 1) {
          shortcutReached = true;
          publish();
        }
        const next = sections[records.length];
        const lapFraction = player.raceFraction * 3 - player.completedLaps;
        if (!uphillReached && lapFraction > .11 && lapFraction < .16 && player.completedLaps === 0) {
          uphillReached = true; publish();
        }
        if (next && lapFraction >= next.from + .04 && lapFraction < next.to && player.completedLaps === 0) {
          records.push({ index: records.length, name: next.name, fraction: lapFraction, position: player.position,
            diagnostics: document.querySelector('[data-testid="render-diagnostics"]')?.textContent ?? "" });
          publish();
        }
        if (player.completedLaps >= 1) {
          completedLaps = player.completedLaps;
          publish(); cleanup();
          // Let driveRace receive this same snapshot before releasing its keys.
          window.setTimeout(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")), 0);
        }
      };
      window.addEventListener(eventName, receive);
      window.addEventListener("kart-meadow-test-stop-observe", cleanup);
    }, { sections: MEADOW_PARK_SECTIONS, middle, eventName: TEST_SNAPSHOT_EVENT });
    await page.getByTestId("start-race").click();
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    const drive = driveRace(page, "玩家", "keyboard", 95_000, 0, false, "meadow", false, shortcut);
    try {
      for (let index = 0; index < MEADOW_PARK_SECTIONS.length; index++) {
        await page.waitForFunction(index => {
          const data = document.documentElement.dataset.meadowParkEvidence;
          return data ? (JSON.parse(data) as { records: readonly unknown[] }).records.length > index : false;
        }, index, { timeout: 85_000 });
        await page.screenshot({ path: `/tmp/meadow-park-${shortcut ? "" : "main-"}section-${index}.png` });
        console.log("meadow district", shortcut ? "shortcut" : "main", index, MEADOW_PARK_SECTIONS[index].name,
          await page.getByTestId("render-diagnostics").textContent());
        if (index === 0) {
          await page.waitForFunction(() => {
            const data = document.documentElement.dataset.meadowParkEvidence;
            return data ? (JSON.parse(data) as { uphillReached: boolean }).uphillReached : false;
          }, undefined, { timeout: 30_000 });
          await page.screenshot({ path: `/tmp/meadow-park-${shortcut ? "shortcut" : "main"}-uphill.png` });
        }
        if (shortcut && index === 3) {
          await page.waitForFunction(() => {
            const data = document.documentElement.dataset.meadowParkEvidence;
            return data ? (JSON.parse(data) as { shortcutReached: boolean }).shortcutReached : false;
          }, undefined, { timeout: 30_000 });
          await page.screenshot({ path: "/tmp/meadow-park-shortcut-descent.png" });
        }
      }
      const result = await drive;
      const evidence = await page.evaluate(() => {
        const data = document.documentElement.dataset.meadowParkEvidence;
        if (!data) throw new Error("Missing meadow snapshot evidence");
        return JSON.parse(data) as { records: readonly { index: number; name: string; fraction: number; position: readonly number[]; diagnostics: string }[];
          shortcutReached: boolean; completedLaps: number; minHeight: number; maxHeight: number };
      });
      console.log("meadow lap evidence", shortcut ? "shortcut" : "main", JSON.stringify(evidence), "driver", JSON.stringify(result), "page errors", JSON.stringify(errors));
      expect(evidence.records).toHaveLength(6);
      if (shortcut) expect(evidence.shortcutReached).toBe(true);
      expect(evidence.completedLaps).toBeGreaterThanOrEqual(1);
      expect(result.laps).toBeGreaterThanOrEqual(1);
      expect(evidence.maxHeight).toBeGreaterThan(15);
      expect(evidence.minHeight).toBeLessThan(1);
      await expect(page.getByTestId("speed-flow")).toHaveAttribute("data-speed", /[0-9]/);
      expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => {
        window.dispatchEvent(new Event("kart-race-test-stop-drive"));
        window.dispatchEvent(new Event("kart-meadow-test-stop-observe"));
      });
      await drive;
      await page.getByRole("button", { name: "顯示 QR Code" }).click();
      await page.getByRole("button", { name: "關閉房間" }).click();
    }
  });
}

test("phone joins meadow park with the shortcut map and a rendered WebGL world", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("button", { name: /風車花谷/ }).click();
  await page.getByRole("button", { name: "單人對戰・手機", exact: true }).click();
  const roomId = await page.getByTestId("room-code").textContent();
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  try {
    const phone = await context.newPage();
    phone.on("pageerror", error => errors.push(error.message));
    await phone.goto(`/controller/${roomId}?e2e=1&stats=1`);
    await phone.getByLabel("暱稱").fill("Park Driver");
    await phone.getByRole("button", { name: "加入房間" }).click();
    await phone.getByRole("button", { name: "準備完成" }).click();
    await page.getByTestId("start-race").click();
    await expect(phone.getByTestId("player-game")).toHaveAttribute("data-track-id", "meadow");
    await expect(phone.getByTestId("course-map")).toHaveAttribute("aria-label", "風車花谷賽道地圖");
    await expect(phone.getByTestId("map-shortcut")).toHaveCount(1);
    await expect(phone.locator(".scene-loading")).toHaveCount(0);
    await expect.poll(async () => Number(await phone.getByTestId("render-diagnostics").getAttribute("data-triangles"))).toBeGreaterThan(10_000);
    await expect.poll(async () => Number(await phone.getByTestId("render-diagnostics").getAttribute("data-calls"))).toBeGreaterThan(20);
    await expect(phone.getByTestId("mobile-controller")).toHaveAttribute("data-phase", "racing");
    await phone.screenshot({ path: "/tmp/meadow-park-phone.png" });
    console.log("meadow phone render", await phone.getByTestId("render-diagnostics").textContent(), "page errors", JSON.stringify(errors));
    expect(errors).toEqual([]);
    await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await page.getByRole("button", { name: "關閉房間" }).click();
  } finally { await context.close(); }
});
