import { expect, test } from "@playwright/test";

test("audio survives room creation and QR collapses at countdown while the item HUD stays clear", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor() {
        super();
        document.documentElement.dataset.audioContexts = String(Number(document.documentElement.dataset.audioContexts ?? 0) + 1);
      }
      override close() {
        document.documentElement.dataset.audioCloses = String(Number(document.documentElement.dataset.audioCloses ?? 0) + 1);
        return super.close();
      }
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/game?mode=bots");
  await page.getByRole("button", { name: "啟用音效", exact: true }).click();
  await page.getByLabel("音效音量").press("Home");
  for (let step = 0; step < 6; step += 1) await page.getByLabel("音效音量").press("ArrowRight");
  for (let room = 0; room < 2; room += 1) {
    await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
    await expect(page.getByTestId("start-race")).toBeEnabled();
    await expect(page.getByRole("button", { name: "靜音", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("音效音量")).toHaveValue("0.3");
    await expect(page.locator("html")).toHaveAttribute("data-audio-contexts", "1");
    await expect(page.locator("html")).not.toHaveAttribute("data-audio-closes", /.+/);
    await page.getByTestId("start-race").click();
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "countdown");
    await expect(page.getByRole("button", { name: "顯示 QR Code" })).toBeVisible();
    await expect(page.getByTestId("room-code")).toHaveCount(0);
    await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    const item = page.getByTestId("controller-item-panel");
    for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(item).toBeInViewport({ ratio: 1 });
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error("Missing item HUD");
      const roomPanel = await page.getByTestId("host-room-panel").boundingBox();
      if (!roomPanel) throw new Error("Missing room controls");
      expect(box.y).toBeGreaterThanOrEqual(roomPanel.y + roomPanel.height);
      expect(box.x + box.width / 2).toBeGreaterThan(viewport.width / 2);
      expect(box.y + box.height / 2).toBeLessThan(viewport.height / 2);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `/tmp/race-interface-${room}.png` });
    await page.getByRole("button", { name: "顯示 QR Code" }).click();
    await expect(page.getByTestId("room-code")).toBeVisible();
    await page.getByRole("button", { name: "關閉房間" }).click();
    await expect(page.getByRole("button", { name: "靜音", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "靜音", exact: true }).click();
  await expect(page.getByRole("button", { name: "啟用音效", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});
