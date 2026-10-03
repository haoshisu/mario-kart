import { expect, test } from "@playwright/test";

const courses = [["meadow", "風車花谷"], ["harbor", "霓虹港都"], ["canyon", "落日砂岩"], ["aurora", "極光冰谷"]] as const;

test("previews and drives every themed circuit, preserving the selected track on reconnect", async ({ page }) => {
  test.setTimeout(100_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/game?stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
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
    console.log(id, await page.getByTestId("render-diagnostics").textContent());
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
    await phone.goto(`/controller/${roomId}`);
    await phone.getByLabel("暱稱").fill("Canyon Driver");
    await phone.getByRole("button", { name: "加入房間" }).click();
    await phone.getByRole("button", { name: "準備完成" }).click();
    await page.getByTestId("start-race").click();
    await expect(phone.getByTestId("player-game")).toHaveAttribute("data-track-id", "canyon");
    await expect(phone.getByTestId("course-map")).toHaveAttribute("aria-label", "落日砂岩賽道地圖");
    await expect(phone.locator(".scene-loading")).toHaveCount(0);
    await expect(phone.locator(".start-light-board")).toBeVisible();
    await phone.screenshot({ path: "/tmp/track-canyon-phone.png" });
    await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await page.getByRole("button", { name: "關閉房間" }).click();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
