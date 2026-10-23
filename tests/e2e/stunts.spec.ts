import { expect, test } from "@playwright/test";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import { driveRace } from "./driveRace";
import { getTrackData } from "../../src/game/track/trackData";
import type { Page } from "@playwright/test";

function rampLane() {
  const track = getTrackData("meadow"), ramp = track.ramps[0];
  const sample = track.samples.reduce((best, sample) =>
    Math.hypot(sample.position[0] - ramp.position[0], sample.position[1] - ramp.position[1]) <
    Math.hypot(best.position[0] - ramp.position[0], best.position[1] - ramp.position[1]) ? sample : best);
  return (ramp.position[0] - sample.position[0]) * sample.normal[0] +
    (ramp.position[1] - sample.position[1]) * sample.normal[1];
}

function drivePractice(page: Page) {
  return page.getByTestId("kart-runtime").evaluate((element, { route, lane }) => new Promise<void>(resolve => {
    const keys = new Set<string>();
    let accumulator = 0;
    const key = (code: string, pressed: boolean) => {
      if (keys.has(code) === pressed) return;
      if (pressed) keys.add(code); else keys.delete(code);
      window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", { code, bubbles: true }));
    };
    const finish = () => {
      window.clearInterval(interval); window.clearTimeout(timeout);
      window.removeEventListener("kart-race-test-stop-drive", finish);
      for (const code of [...keys]) key(code, false);
      resolve();
    };
    const interval = window.setInterval(() => {
      const x = Number(element.getAttribute("data-x")), z = Number(element.getAttribute("data-z"));
      const yaw = Number(element.getAttribute("data-yaw")), speed = Number(element.getAttribute("data-speed"));
      const airborne = Number(element.getAttribute("data-stunt-progress")) > 0;
      let nearest = 0, distance = Infinity;
      route.forEach((sample, i) => {
        const gap = Math.hypot(sample.position[0] - x, sample.position[1] - z, sample.height - Number(element.getAttribute("data-y")) + .52);
        if (gap < distance) { nearest = i; distance = gap; }
      });
      const target = route[(nearest + 7) % route.length];
      const dx = target.position[0] + target.normal[0] * lane - x;
      const dz = target.position[1] + target.normal[1] * lane - z;
      const difference = Math.atan2(-dx, -dz) - yaw;
      const error = Math.atan2(Math.sin(difference), Math.cos(difference));
      const steer = Math.max(-1, Math.min(1, -2 * Math.max(4, speed) * Math.sin(error) /
        (Math.max(1, Math.hypot(dx, dz)) * 1.95 * (airborne ? .45 : 1))));
      accumulator += Math.abs(steer);
      const direction = accumulator >= 1 ? Math.sign(steer) : 0;
      if (direction) accumulator -= 1;
      key("KeyA", direction < 0); key("KeyD", direction > 0);
      const targetSpeed = Math.abs(error) > .45 ? 9 : 14;
      key("KeyW", speed <= targetSpeed); key("KeyS", speed > targetSpeed + 1);
    }, 50);
    const timeout = window.setTimeout(finish, 60_000);
    window.addEventListener("kart-race-test-stop-drive", finish);
  }), { route: getTrackData("meadow").race.RACE_ROUTE_SAMPLES, lane: rampLane() });
}

test("authoritative ramp flight spins the kart and awards turbo on landing", async ({ page }) => {
  test.setTimeout(75_000);
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
  const drive = driveRace(page, "玩家", "keyboard", 60_000, rampLane(), false, "meadow", false);
  const player = page.getByTestId("multiplayer-runtime").locator("span", { hasText: "玩家" });
  await expect.poll(async () => Number(await player.getAttribute("data-stunt-progress")), { timeout: 60_000, intervals: [50] }).toBeGreaterThan(.2);
  await page.screenshot({ path: "/tmp/stunt-airborne.png" });
  const result = await flight;
  expect(result.peak).toBeGreaterThan(19);
  expect(result.spin).toBe(1);
  expect(result.landedTurbo).toBe(2);
  await expect(page.locator(".item-screen-effects")).toHaveClass(/is-boosting/);
  await expect(page.getByTestId("speed-flow")).toHaveAttribute("data-active", "true");
  await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
  await drive;
  await page.screenshot({ path: "/tmp/stunt-landing.png" });
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "顯示 QR Code" }).click();
  await page.getByRole("button", { name: "關閉房間" }).click();
});


test("practice kart flies over the ramp and returns to the road with turbo", async ({ page }) => {
  test.setTimeout(75_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/game?mode=solo&e2e=1");
  const runtime = page.getByTestId("kart-runtime");
  await expect(runtime).toHaveAttribute("data-race-phase", "RACING");
  const drive = drivePractice(page);
  await expect.poll(async () => Number(await runtime.getAttribute("data-stunt-progress")), { timeout: 60_000, intervals: [50] }).toBeGreaterThan(.2);
  await page.screenshot({ path: "/tmp/practice-stunt-airborne.png" });
  await expect.poll(async () => Number(await runtime.getAttribute("data-y")), { intervals: [50] }).toBeGreaterThan(19);
  await expect(runtime).toHaveAttribute("data-stunt-progress", "0");
  await expect(runtime).toHaveAttribute("data-turbo-tier", "2");
  await expect(page.getByTestId("speed-flow")).toHaveAttribute("data-active", "true");
  await page.evaluate(() => window.dispatchEvent(new Event("kart-race-test-stop-drive")));
  await drive;
  expect(errors).toEqual([]);
});
