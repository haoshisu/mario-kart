import { expect, test } from "@playwright/test";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";

test("authoritative ramp flight spins the kart and awards turbo on landing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?e2e=1&stats=1");
  await page.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await page.getByRole("button", { name: "單人對戰・鍵盤", exact: true }).click();
  const flight = page.evaluate(eventName => new Promise<{ peak: number; spin: number; landedTurbo: number }>(resolve => {
    let flying = false, peak = 0, spin = 0;
    const observe = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const snapshot: RaceSnapshot = event.detail;
      const player = snapshot.players.find(player => player.nickname === "玩家");
      if (!player) return;
      if (player.stuntProgress > 0) {
        flying = true; peak = Math.max(peak, player.position[1]); spin = Math.max(spin, player.stuntProgress);
      } else if (flying) {
        window.removeEventListener(eventName, observe);
        resolve({ peak, spin, landedTurbo: player.turboTier });
      }
    };
    window.addEventListener(eventName, observe);
  }), TEST_SNAPSHOT_EVENT);
  await page.getByTestId("start-race").click();
  await expect(page.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
  await page.keyboard.down("KeyW");
  const player = page.getByTestId("multiplayer-runtime").locator("span", { hasText: "玩家" });
  await expect.poll(async () => Number(await player.getAttribute("data-stunt-progress")), { timeout: 10_000, intervals: [50] }).toBeGreaterThan(.2);
  await page.screenshot({ path: "/tmp/stunt-airborne.png" });
  const result = await flight;
  expect(result.peak).toBeGreaterThan(2);
  expect(result.spin).toBe(1);
  expect(result.landedTurbo).toBe(2);
  await page.keyboard.up("KeyW");
  await page.screenshot({ path: "/tmp/stunt-landing.png" });
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "顯示 QR Code" }).click();
  await page.getByRole("button", { name: "關閉房間" }).click();
});


test("practice kart flies over the ramp and returns to the road with turbo", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1");
  const runtime = page.getByTestId("kart-runtime");
  await expect(runtime).toHaveAttribute("data-race-phase", "RACING");
  await page.keyboard.down("KeyW");
  await expect.poll(async () => Number(await runtime.getAttribute("data-stunt-progress")), { timeout: 10_000, intervals: [50] }).toBeGreaterThan(.2);
  await page.screenshot({ path: "/tmp/practice-stunt-airborne.png" });
  await expect.poll(async () => Number(await runtime.getAttribute("data-y")), { intervals: [50] }).toBeGreaterThan(2);
  await expect(runtime).toHaveAttribute("data-stunt-progress", "0");
  await expect(runtime).toHaveAttribute("data-turbo-tier", "2");
  await page.keyboard.up("KeyW");
  expect(errors).toEqual([]);
});
