import { expect, test } from "@playwright/test";

for (const [id, name] of [["taipei", "霓虹疊城"], ["jiufen", "金霧飛城"], ["kaohsiung", "轉港狂潮"], ["alishan", "雲海追光"]]) {
  test(`${id} environment shaders compile and architecture renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/game?mode=solo&e2e=1&stats=1");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await expect(page.getByTestId("kart-runtime")).toHaveAttribute("data-race-phase", "RACING", { timeout: 15000 });
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}
