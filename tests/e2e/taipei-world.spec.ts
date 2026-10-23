import { expect, test } from "@playwright/test";

test("Taipei basin surrounds the circuit in overview, driving and phone quality", async ({ page }) => {
  test.setTimeout(65000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("button", { name: /霓虹疊城/ }).click();
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "doc/images/taipei-world/overview.png" });
  await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
  await expect(page.locator(".player-nameplate")).toHaveCount(4);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "doc/images/taipei-world/four-cars.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "doc/images/taipei-world/mobile-low.png" });
  const diagnostics = page.getByTestId("render-diagnostics");
  console.log("Taipei world four cars low", await diagnostics.textContent());
  expect(Number(await diagnostics.getAttribute("data-triangles"))).toBeLessThanOrEqual(200000);
  await page.getByRole("button", { name: "關閉房間", exact: true }).click();
  expect(errors).toEqual([]);
});

test("Taipei world stays visible while racing and when inspecting from above", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1&stats=1");
  await page.getByRole("button", { name: /霓虹疊城/ }).click();
  await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 15000 });
  await page.keyboard.down("KeyW"); await page.waitForTimeout(2800); await page.keyboard.up("KeyW");
  expect(Number(await page.getByTestId("kart-runtime").getAttribute("data-speed"))).toBeGreaterThan(5);
  await page.screenshot({ path: "doc/images/taipei-world/drive.png" });
  await page.getByRole("button", { name: "檢查賽道", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "doc/images/taipei-world/inspect.png" });
  expect(errors).toEqual([]);
});
