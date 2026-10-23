import { expect, test, type Page } from "@playwright/test";
import { getTrackData } from "../../src/game/track/trackData";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import { driveRace } from "./driveRace";

for (const mode of ["keyboard", "phone"] as const) test(`${mode} four-kart race renders full-width rows and frequently supplies normal driving lines`, async ({ browser, page: host }) => {
  test.setTimeout(75_000);
  const trackId = mode === "phone" ? "taipei" : "meadow", track = getTrackData(trackId);
  const errors: string[] = []; host.on("pageerror", error => errors.push(error.message));
  await host.goto("/game?e2e=1&stats=1");
  await host.getByRole("combobox", { name: "畫質" }).selectOption("low");
  if (trackId === "taipei") await host.getByRole("button", { name: /台北・霓虹疊城/ }).click();
  await host.getByRole("button", { name: mode === "phone" ? "單人對戰・手機" : "單人對戰・鍵盤", exact: true }).click();
  const context = mode === "phone" ? await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }) : null;
  let player: Page = host, driving: ReturnType<typeof driveRace> | undefined;
  const nickname = mode === "phone" ? "Supply Driver" : "玩家";
  try {
    if (context) {
      player = await context.newPage(); player.on("pageerror", error => errors.push(error.message));
      const room = await host.getByTestId("room-code").textContent();
      await player.goto(`/controller/${room}?e2e=1&stats=1`);
      await player.getByLabel("暱稱").fill(nickname);
      await player.getByRole("button", { name: "加入房間", exact: true }).click();
      await player.getByRole("button", { name: "準備完成", exact: true }).click();
    }
    await player.evaluate(({ eventName, nickname, firstRow }) => {
      const rows = new Set<string>(), firstRowDrivers = new Set<string>(), suppliedDrivers = new Set<string>();
      let firstPickup: string | null = null, approach = false, restored = false, lastEvent = 0;
      window.addEventListener(eventName, event => {
        if (!(event instanceof CustomEvent)) return;
        const snapshot = event.detail as RaceSnapshot;
        const me = snapshot.players.find(p => p.nickname === nickname);
        if (!me) return;
        const dx = firstRow.position[0] - me.position[0], dz = firstRow.position[1] - me.position[2];
        const ahead = -Math.sin(firstRow.yaw) * dx - Math.cos(firstRow.yaw) * dz;
        approach ||= snapshot.phase === "racing" && ahead > 12 && ahead < 25;
        for (const action of snapshot.items.events) {
          if (action.id <= lastEvent) continue;
          lastEvent = action.id;
          if (action.kind !== "pickup") continue;
          suppliedDrivers.add(action.playerId);
          if (action.sourceId.startsWith("box-0-")) firstRowDrivers.add(action.playerId);
          if (action.playerId === me.id) {
            rows.add(action.sourceId.split("-").slice(0, 2).join("-"));
            firstPickup ??= action.sourceId;
          }
        }
        if (firstPickup && snapshot.items.boxes.find(box => box.id === firstPickup)?.remaining === 0) restored = true;
        const data = document.documentElement.dataset;
        data.supplyBoxCount = String(snapshot.items.boxes.length);
        data.supplyRows = String(rows.size); data.supplyFirstRowDrivers = String(firstRowDrivers.size);
        data.supplyApproach = String(approach); data.supplyRestored = String(restored);
        data.suppliedDrivers = String(suppliedDrivers.size);
        data.supplyDriverState = JSON.stringify({ position: me.position, speed: me.speed, held: me.item.held });
      });
    }, { eventName: TEST_SNAPSHOT_EVENT, nickname, firstRow: track.items.ITEM_BOXES[0] });
    await host.getByTestId("start-race").click();
    if (mode === "phone") {
      await player.evaluate(() => Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => "granted" }));
      await player.getByRole("button", { name: "啟用傾斜", exact: true }).tap();
    }
    // Follow a normal outer driving line without seeking a selected box. The
    // CPU convoy contests centre columns, while full rows supply either side.
    driving = driveRace(player, nickname, mode === "phone" ? "touch" : "keyboard", 55_000, mode === "phone" ? 2.4 : -2.4, true, trackId, false);
    await expect(player.locator("html")).toHaveAttribute("data-supply-box-count", String(track.items.ITEM_BOXES.length));
    await expect(player.locator("html")).toHaveAttribute("data-supply-approach", "true", { timeout: 10_000 });
    await player.screenshot({ path: `/tmp/item-rows-${trackId}-${mode}.png` });
    // A convoy can contest the same column. Verify the whole race supplies all
    // four drivers; the pure test separately crosses four distinct columns.
    await expect(player.locator("html")).toHaveAttribute("data-supplied-drivers", "4", { timeout: 30_000 });
    await expect.poll(async () => Number(await player.locator("html").getAttribute("data-supply-rows")), { timeout: 35_000 }).toBeGreaterThanOrEqual(3);
    await expect(player.locator("html")).toHaveAttribute("data-supply-restored", "true");
    await player.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
    expect((await driving).usedItem).toBe(true);
    console.log("Supply render", mode, await player.getByTestId("render-diagnostics").textContent());
    expect(errors).toEqual([]);
  } finally {
    console.log("Supply observations", mode, await player.locator("html").evaluate(node => ({ ...node.dataset })));
    await player.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive"))); await driving;
    const show = host.getByRole("button", { name: "顯示 QR Code", exact: true }); if (await show.isVisible()) await show.click();
    await host.getByRole("button", { name: "關閉房間", exact: true }).click();
    await context?.close();
  }
});
