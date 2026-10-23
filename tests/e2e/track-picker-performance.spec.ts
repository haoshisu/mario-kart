import { expect, test } from "@playwright/test";
import { TRACK_CATALOG, TRACK_IDS } from "../../src/game/track/trackCatalog";
import { createTrackSamples } from "../../src/game/track/trackPath";

test("track picker stays responsive and Taiwan tracks load in both quality settings", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const began = performance.now();
  await page.goto("/game?stats=1");
  const picker = page.getByRole("group", { name: "選擇賽道" });
  await expect(picker.getByRole("button")).toHaveCount(13);
  await expect(picker.locator("svg path")).toHaveCount(26);
  console.log("picker-visible-ms", Math.round(performance.now() - began));
  const paths = await picker.locator("svg path:first-child").evaluateAll(elements => elements.map(element => {
    if (!(element instanceof SVGPathElement)) throw new Error("Missing SVG path");
    return { length: element.getTotalLength(), characters: element.getAttribute("d")?.length ?? 0 };
  }));
  for (const [index, id] of TRACK_IDS.entries()) {
    const track = TRACK_CATALOG[id];
    const samples = createTrackSamples(track.curves, track.elevation);
    const length = samples.reduce((sum, sample, i) => {
      const next = samples[(i + 1) % samples.length];
      return sum + Math.hypot(next.position[0] - sample.position[0], next.position[1] - sample.position[1]);
    }, 0);
    expect(Math.abs(paths[index].length - length) / length).toBeLessThan(.01);
  }
  const characters = paths.reduce((sum, path) => sum + path.characters, 0);
  console.log("preview-path-characters", characters);
  if (process.env.PREVIEW_BENCH_STAGE !== "before") expect(characters).toBeLessThan(20000);
  await expect(page.locator(".scene-loading")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId("render-diagnostics")).toContainText("FPS", { timeout: 20_000 });
  await page.getByRole("button", { name: /府城暖巷/ }).click();
  await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", "tainan");
  await expect(page.locator(".scene-loading")).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `/tmp/track-picker-${process.env.PREVIEW_BENCH_STAGE ?? "after"}-desktop.png` });
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /綠園光廊/ }).click();
  await expect(page.locator(".game-canvas")).toHaveAttribute("data-track-id", "taichung");
  await expect(page.locator(".scene-loading")).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `/tmp/track-picker-${process.env.PREVIEW_BENCH_STAGE ?? "after"}-mobile.png` });
  expect(errors).toEqual([]);
});
