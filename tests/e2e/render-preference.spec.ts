import { expect, test } from "@playwright/test";
import { RENDER_QUALITY_KEY } from "../../src/game/rendering/renderPreference";

test("saved low quality loads low models directly and manual quality survives reload", async ({ page }) => {
  test.setTimeout(55_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(key => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, "low");
  }, RENDER_QUALITY_KEY);
  const models: string[] = [];
  page.on("request", request => { if (request.url().endsWith(".glb")) models.push(new URL(request.url()).pathname); });
  await page.goto("/game?mode=solo");
  await expect(page.getByRole("combobox", { name: "畫質", exact: true })).toHaveValue("low");
  await expect(page.getByTestId("kart-status")).toHaveText("READY", { timeout: 20_000 });
  expect(models).toContain("/models/chibi-dodo-low-v1.glb");
  expect(models).not.toContain("/models/chibi-dodo-v1.glb");
  await page.getByRole("combobox", { name: "畫質", exact: true }).selectOption("standard");
  await expect.poll(() => models.includes("/models/chibi-dodo-v1.glb")).toBe(true);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "畫質", exact: true })).toHaveValue("standard");
  await page.getByRole("combobox", { name: "畫質", exact: true }).selectOption("low");
  await page.goto("/game");
  await expect(page.getByRole("combobox", { name: "畫質", exact: true })).toHaveValue("low");
  expect(await page.evaluate(key => localStorage.getItem(key), RENDER_QUALITY_KEY)).toBe("low");
  expect(errors).toEqual([]);
});
test("blocked preference storage keeps the game usable on a narrow screen", async ({ page }) => {
  test.setTimeout(45_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(key => {
    const getItem = Storage.prototype.getItem, setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function(name) {
      if (name === key) throw new DOMException("Denied", "SecurityError");
      return getItem.call(this, name);
    };
    Storage.prototype.setItem = function(name, value) {
      if (name === key) throw new DOMException("Quota", "QuotaExceededError");
      return setItem.call(this, name, value);
    };
  }, RENDER_QUALITY_KEY);
  await page.goto("/game?mode=solo");
  await expect(page.getByRole("combobox", { name: "畫質", exact: true })).toHaveValue("standard");
  await page.getByRole("combobox", { name: "畫質", exact: true }).selectOption("low");
  await expect(page.getByTestId("kart-status")).toHaveText("READY", { timeout: 20_000 });
  await expect(page.getByRole("status").filter({ hasText: "無法儲存畫質" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "畫質", exact: true })).toHaveValue("low");
  await page.screenshot({ path: "/tmp/render-preference-mobile.png" });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "畫質", exact: true })).toHaveValue("standard");
  expect(errors).toEqual([]);
});
