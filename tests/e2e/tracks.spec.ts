import { expect, test } from "@playwright/test";
import { driveRace } from "./driveRace";
import { createCircuitSection } from "../../src/game/track/circuitSections";
import { getTrackData } from "../../src/game/track/trackData";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";

const courses = [["meadow", "風車花谷"], ["harbor", "霓虹港都"], ["canyon", "落日砂岩"], ["aurora", "極光冰谷"]] as const;

test("previews and drives every themed circuit, preserving the selected track on reconnect", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  // Long and tall circuits must remain whole in the selector thumbnails.
  const thumbnails = await page.getByRole("group", { name: "選擇賽道" }).locator("svg").evaluateAll(elements => elements.map(element => {
    if (!(element instanceof SVGSVGElement)) return false;
    const path = element.querySelector("path");
    if (!path) return false;
    const bounds = path.getBBox(), view = element.viewBox.baseVal;
    return bounds.x >= view.x && bounds.y >= view.y &&
      bounds.x + bounds.width <= view.x + view.width && bounds.y + bounds.height <= view.y + view.height;
  }));
  expect(thumbnails).toEqual([true, true, true, true, true, true, true]);
  for (const [id, name] of courses) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", id);
    await expect(page.getByTestId("course-map")).toHaveAttribute("aria-label", `${name}賽道地圖`);
    await expect.poll(async () => Number(await page.getByTestId("render-diagnostics").getAttribute("data-calls"))).toBeGreaterThan(20);
    await page.screenshot({ path: `/tmp/track-${id}-preview.png` });
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    await expect(page.getByTestId("room-track")).toHaveText(name);
    if (id === "aurora") {
      await page.reload();
      await expect(page.getByTestId("room-track")).toHaveText(name);
      await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", id);
    }
    await page.getByTestId("start-race").click();
    await expect(page.locator(".start-light-board")).toBeVisible();
    await expect(page.locator(".start-lamp")).toHaveCount(3);
    await page.screenshot({ path: `/tmp/track-${id}-lights.png` });
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    await page.keyboard.down("KeyW");
    await expect.poll(async () => Number(await page.getByTestId("multiplayer-runtime").locator("span", { hasText: "玩家" }).getAttribute("data-speed"))).toBeGreaterThan(4);
    await page.keyboard.up("KeyW");
    await page.screenshot({ path: `/tmp/track-${id}-drive.png` });
    const selectedTrack = getTrackData(id);
    const section = createCircuitSection(id, selectedTrack.race.RACE_ROUTE_SAMPLES, selectedTrack.branches);
    const reachedSection = page.evaluate(({ target, eventName }) => new Promise<boolean>(resolve => {
      const finish = (reached: boolean) => { window.clearTimeout(timeout); window.removeEventListener(eventName, receive); resolve(reached); };
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const player = (event.detail as RaceSnapshot).players.find(player => player.nickname === "玩家");
        if (player && Math.hypot(player.position[0] - target[0], player.position[2] - target[2]) < 4) finish(true);
      };
      const timeout = window.setTimeout(() => finish(false), 40_000);
      window.addEventListener(eventName, receive);
    }), { target: section.frames[Math.floor(section.frames.length / 2)].position, eventName: TEST_SNAPSHOT_EVENT });
    const drive = driveRace(page, "玩家", "keyboard", 45_000, 0, false, id, false);
    try {
      expect(await reachedSection, section.name).toBe(true);
      await page.screenshot({ path: `/tmp/track-${id}-signature.png` });
      console.log(id, section.name, await page.getByTestId("render-diagnostics").textContent());
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
      await drive;
    }
    await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await page.getByRole("button", { name: "關閉房間" }).click();
    await expect(page.getByRole("group", { name: "選擇賽道" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("phone joins the host's canyon and the track picker fits small screens", async ({ browser, page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/game");
  await page.getByRole("button", { name: /落日砂岩/ }).click();
  const picker = await page.getByRole("group", { name: "選擇賽道" }).boundingBox();
  expect(picker!.x).toBeGreaterThanOrEqual(0);
  expect(picker!.x + picker!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "/tmp/track-picker-phone.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "單人對戰・手機", exact: true }).click();
  const roomId = await page.getByTestId("room-code").textContent();
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  try {
    const phone = await context.newPage();
    phone.on("pageerror", (error) => errors.push(error.message));
    await phone.goto(`/controller/${roomId}?e2e=1&stats=1`);
    await phone.getByLabel("暱稱").fill("Canyon Driver");
    await phone.getByRole("button", { name: "加入房間" }).click();
    await phone.getByRole("button", { name: "準備完成" }).click();
    await page.getByTestId("start-race").click();
    await expect(phone.getByTestId("player-game")).toHaveAttribute("data-track-id", "canyon");
    await expect(phone.getByTestId("course-map")).toHaveAttribute("aria-label", "落日砂岩賽道地圖");
    await expect(phone.getByTestId("map-shortcut")).toHaveCount(1);
    await expect(phone.locator(".scene-loading")).toHaveCount(0);
    await expect(phone.locator(".start-light-board")).toBeVisible();
    await expect.poll(async () => Number(await phone.getByTestId("render-diagnostics").getAttribute("data-triangles"))).toBeGreaterThan(10_000);
    await expect(phone.getByTestId("mobile-controller")).toHaveAttribute("data-phase", "racing");
    await expect.poll(async () => Number(await phone.getByTestId("mobile-controller").getAttribute("data-speed"))).toBeGreaterThan(4);
    await phone.screenshot({ path: "/tmp/track-canyon-phone.png" });
    await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await page.getByRole("button", { name: "關閉房間" }).click();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
