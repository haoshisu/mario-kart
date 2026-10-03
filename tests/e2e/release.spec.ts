import { expect, test } from "@playwright/test";

test("original GLBs render with diagnostics and low quality fallback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const assets: string[] = [];
  page.on("response", (response) => { if (response.url().endsWith(".glb") && response.ok()) assets.push(response.url()); });
  await page.goto("/game?mode=solo&stats=1");
  await expect(page.getByTestId("kart-status")).toHaveText("READY", { timeout: 20_000 });
  await expect(page.getByTestId("render-diagnostics")).toContainText("FPS");
  expect(assets.some((url) => url.includes("pulse-kart"))).toBe(true);
  expect(assets.some((url) => url.includes("pulse-wheel"))).toBe(true);
  await page.screenshot({ path: "/tmp/phase6-standard.png" });
  const standardCalls = Number(await page.getByTestId("render-diagnostics").getAttribute("data-calls"));
  await page.getByLabel("畫質").selectOption("low");
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId("render-diagnostics").getAttribute("data-calls"))).toBeLessThan(standardCalls);
  console.log("Phase 6 low-quality sample:", await page.getByTestId("render-diagnostics").textContent());
  await page.screenshot({ path: "/tmp/phase6-low.png" });
  expect(errors).toEqual([]);
});

test("asset failure has an actionable error screen", async ({ page }) => {
  await page.route("**/models/*.glb", (route) => route.abort());
  await page.goto("/game?mode=solo");
  await expect(page.getByRole("alert").filter({ hasText: "3D 資產或 WebGL 載入失敗" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新載入", exact: true })).toBeVisible();
});

test("cold start can be cancelled and retried without duplicate rooms", async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ status: 503, body: "starting" }));
  await page.goto("/game");
  await page.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("正在啟動伺服器");
  await page.getByRole("button", { name: "取消連線" }).click();
  await expect(page.getByTestId("host-room-panel")).toHaveAttribute("data-room-phase", "idle");
  await page.unroute("**/health");
  await page.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  await expect(page.getByTestId("room-code")).toBeVisible();
  await page.getByRole("button", { name: "關閉房間", exact: true }).click();
  await expect(page.getByTestId("host-room-panel")).toHaveAttribute("data-room-phase", "idle");
});

test("WebGL context loss shows recovery feedback and restores", async ({ page }) => {
  await page.goto("/game?mode=solo");
  await expect(page.getByTestId("kart-status")).toHaveText("READY", { timeout: 20_000 });
  const supported = await page.locator("canvas").evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const gl = canvas.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    window.setTimeout(() => extension.restoreContext(), 2_000);
    return true;
  });
  expect(supported).toBe(true);
  await expect(page.getByRole("alert").filter({ hasText: "3D 顯示暫時中斷" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "3D 顯示暫時中斷" })).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator("canvas")).toBeVisible();
});
