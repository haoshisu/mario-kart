import { expect, test } from "@playwright/test";
import { driveRace } from "./driveRace";

test("keyboard item pickup and activation show the driving feedback", async ({ page }) => {
  test.setTimeout(65_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/game?e2e=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
  await page.getByTestId("start-race").click();
  await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
  const drive = driveRace(page, "玩家", "keyboard", 45_000, 0, false, "meadow", true);
  try {
    await expect(page.getByTestId("use-item")).toBeEnabled({ timeout: 35_000 });
    await expect(page.getByTestId("item-feedback-banner")).toContainText("取得");
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("item-feedback-banner")).toContainText("發動");
    await expect(page.getByTestId("item-feedback-banner")).toHaveCSS("animation-name", "none");
    await page.screenshot({ path: "/tmp/driving-feedback-keyboard.png" });
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
    await drive;
    await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await page.getByRole("button", { name: "關閉房間", exact: true }).click();
  }
});
