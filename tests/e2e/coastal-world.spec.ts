import { expect, test } from "@playwright/test";

for (const [id, name] of [["jiufen", "金霧飛城"], ["kaohsiung", "轉港狂潮"]]) {
  test(`${id} full world renders in overview, four-car low quality and driving`, async ({ page }) => {
    test.setTimeout(65000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/game?e2e=1&stats=1");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".scene-loading")).toHaveCount(0); await page.waitForTimeout(2000);
    await page.screenshot({ path: `doc/images/coastal-world/${id}-overview.png` });
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    await expect(page.locator(".player-nameplate")).toHaveCount(4);
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(2500);
    const diagnostics = page.getByTestId("render-diagnostics");
    console.log(id, await diagnostics.textContent());
    expect(Number(await diagnostics.getAttribute("data-triangles"))).toBeLessThanOrEqual(200000);
    await page.screenshot({ path: `doc/images/coastal-world/${id}-mobile-low.png` });
    await page.getByRole("button", { name: "關閉房間", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/game?mode=solo&e2e=1&stats=1");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 15000 });
    await page.keyboard.down("KeyW"); await page.waitForTimeout(2800); await page.keyboard.up("KeyW");
    expect(Number(await page.getByTestId("kart-runtime").getAttribute("data-speed"))).toBeGreaterThan(5);
    await page.screenshot({ path: `doc/images/coastal-world/${id}-drive.png` });
    await page.getByRole("button", { name: "檢查賽道", exact: true }).click(); await page.waitForTimeout(1500);
    await page.screenshot({ path: `doc/images/coastal-world/${id}-inspect.png` });
    // Only hide the selection panel for a clear photograph of the rendered world.
    await page.addStyleTag({ content: ".host-room-panel { visibility: hidden; }" });
    await page.screenshot({ path: `doc/images/coastal-world/${id}-panorama.png` });
    expect(errors).toEqual([]);
  });
}
