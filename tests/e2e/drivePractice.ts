import type { Page } from "@playwright/test";
import { getTrackData } from "../../src/game/track/trackData";
import type { TrackId } from "../../src/game/track/trackCatalog";

/** Real keyboard input follows the authored surface; no pose/CP overrides. */
export function drivePractice(page: Page, trackId: TrackId, lane: number, trick: boolean) {
  return page.getByTestId("kart-runtime").evaluate((element, { route, lane, trick }) => new Promise<{
    peak: number; spin: number; turbo: number;
  }>(resolve => {
    const keys = new Set<string>();
    let accumulator = 0, flying = false, peak = 0, spin = 0, trickUntil = 0;
    const key = (code: string, pressed: boolean) => {
      if (keys.has(code) === pressed) return;
      if (pressed) keys.add(code); else keys.delete(code);
      window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", { code, bubbles: true }));
    };
    const finish = () => {
      window.clearInterval(interval); window.clearTimeout(timeout);
      window.removeEventListener("kart-race-test-stop-drive", finish);
      for (const code of [...keys]) key(code, false);
      resolve({ peak, spin, turbo: Number(element.getAttribute("data-turbo-tier")) });
    };
    const interval = window.setInterval(() => {
      const x = Number(element.getAttribute("data-x")), z = Number(element.getAttribute("data-z"));
      const y = Number(element.getAttribute("data-y")), yaw = Number(element.getAttribute("data-yaw"));
      const speed = Number(element.getAttribute("data-speed")), progress = Number(element.getAttribute("data-stunt-progress"));
      if (progress > 0) {
        if (!flying && trick) trickUntil = performance.now() + 100;
        flying = true; peak = Math.max(peak, y); spin = Math.max(spin, progress);
      } else if (flying) { finish(); return; }
      key("Space", performance.now() < trickUntil);
      let nearest = 0, distance = Infinity;
      route.forEach((sample, i) => {
        const gap = Math.hypot(sample.position[0] - x, sample.position[1] - z, sample.height - y + .52);
        if (gap < distance) { nearest = i; distance = gap; }
      });
      const target = route[(nearest + 7) % route.length];
      const dx = target.position[0] + target.normal[0] * lane - x;
      const dz = target.position[1] + target.normal[1] * lane - z;
      const difference = Math.atan2(-dx, -dz) - yaw;
      const error = Math.atan2(Math.sin(difference), Math.cos(difference));
      const steer = Math.max(-1, Math.min(1, -2 * Math.max(4, speed) * Math.sin(error) /
        (Math.max(1, Math.hypot(dx, dz)) * 1.95 * (progress > 0 ? .45 : 1))));
      accumulator += Math.abs(steer);
      const direction = accumulator >= 1 ? Math.sign(steer) : 0;
      if (direction) accumulator -= 1;
      key("KeyA", direction < 0); key("KeyD", direction > 0);
      const targetSpeed = Math.abs(error) > .45 ? 9 : 14;
      key("KeyW", speed <= targetSpeed); key("KeyS", speed > targetSpeed + 1);
    }, 50);
    const timeout = window.setTimeout(finish, 120_000);
    window.addEventListener("kart-race-test-stop-drive", finish);
  }), { route: getTrackData(trackId).race.RACE_ROUTE_SAMPLES, lane, trick });
}
