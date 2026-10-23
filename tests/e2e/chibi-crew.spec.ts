import { expect, test, type Page } from "@playwright/test";
import type { RaceSnapshot } from "../../src/game/network/protocol";

async function observeCrew(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener("kart-race-test-snapshot", event => {
      const snapshot = (event as CustomEvent<RaceSnapshot>).detail;
      document.documentElement.dataset.crew = JSON.stringify(snapshot.players.map(player => ({
        id: player.id, characterId: player.characterId, speed: player.speed,
      })));
    });
  });
}
const crew = (page: Page) => page.evaluate(() => JSON.parse(document.documentElement.dataset.crew ?? "[]") as { id: string; characterId: string; speed: number }[]);

test("practice switches all four characters, both qualities, victory and restart", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [], models = new Set<string>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.ok() && response.url().includes("/models/chibi-")) models.add(response.url().split("/").at(-1) ?? ""); });
  await page.goto("/game?mode=solo&e2e=1&stats=1");
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 20000 });
  for (const [id, name] of [["dodo", "豆豆"], ["lumi", "露米"], ["lili", "栗栗"], ["bibo", "嗶波"]]) {
    if (await page.getByRole("button", { name: "選圖與賽事", exact: true }).isVisible()) await page.getByRole("button", { name: "選圖與賽事", exact: true }).click();
    await page.getByRole("button", { name: `選擇${name}`, exact: true }).click();
    await expect(page.getByRole("button", { name: `選擇${name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
    for (const quality of ["standard", "low"]) {
      await page.getByRole("combobox", { name: "畫質" }).selectOption(quality);
      await expect.poll(() => models.has(`chibi-${id}${quality === "low" ? "-low" : ""}-v1.glb`)).toBe(true);
      await expect(page.locator(".scene-loading")).toHaveCount(0);
    }
  }
  await page.getByRole("button", { name: "返回駕駛", exact: true }).click();
  await page.keyboard.down("KeyW");
  await expect.poll(async () => Number(await page.getByTestId("kart-runtime").getAttribute("data-speed"))).toBeGreaterThan(5);
  await page.keyboard.up("KeyW");
  await page.screenshot({ path: "doc/images/chibi-crew/practice-bibo.png" });
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-advance"))); await page.waitForTimeout(40); }
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "FINISHED");
  const overlay = await page.addStyleTag({ content: ".finish-screen { visibility: hidden; }" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "doc/images/chibi-crew/victory.png" });
  await overlay.evaluate(node => node.parentNode?.removeChild(node));
  await page.getByRole("button", { name: "重新比賽", exact: true }).click();
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 15000 });
  expect(errors).toEqual([]);
});

test("chosen host and three different CPU characters survive reconnect and drive", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await observeCrew(page);
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("button", { name: "選擇露米", exact: true }).click();
  await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
  await expect(page.locator(".player-nameplate")).toHaveCount(4, { timeout: 20000 });
  await expect.poll(async () => (await crew(page)).map(p => p.characterId).sort()).toEqual(["bibo", "dodo", "lili", "lumi"]);
  const hostId = await page.locator(".game-canvas").getAttribute("data-follow-player");
  expect((await crew(page)).find(p => p.id === hostId)?.characterId).toBe("lumi");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "doc/images/chibi-crew/four-cars.png" });
  await page.reload();
  await expect(page.locator(".player-nameplate")).toHaveCount(4, { timeout: 20000 });
  await expect.poll(async () => (await crew(page)).find(p => p.id === hostId)?.characterId).toBe("lumi");
  await page.getByTestId("start-race").click();
  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await crew(page)).find(p => p.id === hostId)?.speed ?? 0, { timeout: 15000 }).toBeGreaterThan(5);
  await page.keyboard.up("KeyW");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.waitForTimeout(700);
  await page.screenshot({ path: "doc/images/chibi-crew/four-cars-mobile.png" });
  await page.getByRole("button", { name: "顯示 QR Code", exact: true }).click();
  await page.getByRole("button", { name: "關閉房間", exact: true }).click();
  expect(errors).toEqual([]);
});

test("phone character selection syncs to host and survives reconnect", async ({ page, context }) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await observeCrew(page);
  await page.goto("/game?e2e=1");
  await page.getByRole("button", { name: "選擇栗栗", exact: true }).click();
  await page.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  await expect(page.getByTestId("room-code")).toBeVisible({ timeout: 15000 });
  const id = await page.getByTestId("room-code").textContent();
  const phone = await context.newPage();
  phone.on("pageerror", error => errors.push(error.message));
  await phone.setViewportSize({ width: 390, height: 844 });
  await observeCrew(phone);
  await phone.goto(`/controller/${id}?e2e=1`);
  await phone.getByLabel("暱稱", { exact: true }).fill("Q版玩家");
  await phone.getByRole("button", { name: "選擇嗶波", exact: true }).click();
  await phone.screenshot({ path: "doc/images/chibi-crew/phone-picker.png" });
  await phone.getByRole("button", { name: "加入房間", exact: true }).click();
  await expect.poll(async () => (await crew(page)).map(p => p.characterId).sort()).toEqual(["bibo", "lili"]);
  await expect.poll(async () => (await crew(phone)).map(p => p.characterId).sort()).toEqual(["bibo", "lili"]);
  await phone.reload();
  await expect.poll(async () => (await crew(phone)).map(p => p.characterId).sort(), { timeout: 20000 }).toEqual(["bibo", "lili"]);
  await phone.setViewportSize({ width: 844, height: 390 });
  await phone.waitForTimeout(700);
  await phone.screenshot({ path: "doc/images/chibi-crew/phone-lobby.png" });
  await page.getByRole("button", { name: "關閉房間", exact: true }).click();
  await phone.close();
  expect(errors).toEqual([]);
});
