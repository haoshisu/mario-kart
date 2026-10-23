import { expect, test } from "@playwright/test";

for (const [id, name] of [["taipei", "霓虹疊城"], ["jiufen", "金霧飛城"], ["kaohsiung", "轉港狂潮"]]) {
  test(`${id} city dressing loads in both qualities and remains driveable`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [], assets: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.url().includes("/models/taiwan-city")) { expect(response.ok()).toBe(true); assets.push(response.url()); } });
    await page.goto("/game?mode=solo&e2e=1&stats=1");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const runtime = page.getByTestId("kart-runtime");
    await expect(runtime).toHaveAttribute("data-race-phase", "RACING", { timeout: 20000 });
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `doc/images/taiwan-city/${id}-standard.png` });
    const before = Number(await runtime.getAttribute("data-x"));
    await page.keyboard.down("KeyW"); await page.waitForTimeout(2800); await page.keyboard.up("KeyW");
    expect(Number(await runtime.getAttribute("data-speed"))).toBeGreaterThan(5);
    expect(Math.abs(Number(await runtime.getAttribute("data-x")) - before)).toBeGreaterThan(8);
    await page.screenshot({ path: `doc/images/taiwan-city/${id}-drive.png` });
    await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await page.waitForTimeout(2000);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.screenshot({ path: `doc/images/taiwan-city/${id}-mobile-low.png` });
    console.log(id, await page.getByTestId("render-diagnostics").textContent());
    expect(assets.some(url => url.endsWith("taiwan-city-v1.glb"))).toBe(true);
    expect(assets.some(url => url.endsWith("taiwan-city-low-v1.glb"))).toBe(true);
    expect(errors).toEqual([]);
  });
}
