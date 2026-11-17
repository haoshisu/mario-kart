import { expect, test } from "@playwright/test";
import { driveRace } from "./driveRace";

test("drives a raised canyon, stores two icons and uses the front item with E", async ({ page }) => {
  test.setTimeout(210_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("button", { name: /落日砂岩/ }).click();
  await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
  // The key guide is shown before the start and gives way to the road once racing.
  await expect(page.getByLabel("按鍵說明")).toContainText("↑ 加速");
  await page.getByTestId("start-race").click();
  await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
  await expect(page.getByLabel("按鍵說明")).toHaveCount(0);
  await page.keyboard.down("ArrowUp");
  const player = page.getByTestId("multiplayer-runtime").locator("span", { hasText: "玩家" });
  await expect.poll(async () => Number(await player.getAttribute("data-speed"))).toBeGreaterThan(3);
  await page.keyboard.up("ArrowUp");
  const drive = driveRace(page, "玩家", "keyboard", 180_000, -.9, false, "canyon", true);
  try {
    await expect.poll(async () => Number(await player.getAttribute("data-y")), { timeout: 25_000 }).toBeGreaterThan(7);
    await page.screenshot({ path: "/tmp/elevated-canyon-driving.png" });
    const slots = page.getByTestId("controller-item-panel").locator("[data-slot]");
    await expect(slots).toHaveCount(2);
    await expect(slots.nth(1)).not.toHaveAttribute("data-item", "none", { timeout: 45_000 });
    const reserve = await slots.nth(1).getAttribute("data-item");
    await page.screenshot({ path: "/tmp/two-item-slots.png" });
    await expect(page.getByTestId("use-item")).toBeEnabled();
    await page.keyboard.press("KeyE");
    await expect(slots.nth(0)).toHaveAttribute("data-item", reserve!);
    await expect(slots.nth(1)).toHaveAttribute("data-item", "none");
    await expect(page.getByTestId("item-feedback-banner")).toContainText("發動");
    await page.screenshot({ path: "/tmp/item-activation-feedback.png" });
    const result = await drive;
    expect(result.status).toBe("finished");
    expect(result.laps).toBe(3);
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
    await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await page.getByRole("button", { name: "關閉房間" }).click();
    await drive;
  }
});
