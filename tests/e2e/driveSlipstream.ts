import type { Page } from "@playwright/test";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import { getTrackData } from "../../src/game/track/trackData";

/** Real device intent only; neither the pose nor snapshots are overwritten. */
export function driveSlipstream(page: Page, nickname: string, follower: boolean, touch = false) {
  return page.evaluate(({ nickname, follower, touch, eventName, route }) => new Promise<{
    charge: number; ready: boolean; revision: number; peakBoostSpeed: number;
  }>(resolve => {
    let snapshot: RaceSnapshot | null = null, steeringAccumulator = 0, firstReady = 0, firstBoost = 0;
    let charge = 0, ready = false, revision = 0, peakBoostSpeed = 0;
    const keys = new Set<string>(); let braking = false;
    const key = (code: string, pressed: boolean) => {
      if (keys.has(code) === pressed) return;
      if (pressed) keys.add(code); else keys.delete(code);
      window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", { code, bubbles: true }));
    };
    const finish = () => {
      window.clearInterval(timer); window.clearTimeout(timeout);
      window.removeEventListener(eventName, receive); window.removeEventListener("kart-race-test-stop-drive", finish);
      for (const code of [...keys]) key(code, false);
      if (touch) window.dispatchEvent(new Event("blur"));
      resolve({ charge, ready, revision, peakBoostSpeed });
    };
    const receive = (event: Event) => { if (event instanceof CustomEvent) snapshot = event.detail as RaceSnapshot; };
    window.addEventListener(eventName, receive); window.addEventListener("kart-race-test-stop-drive", finish);
    window.dispatchEvent(new Event("focus"));
    if (touch) window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 0 }));
    const timer = window.setInterval(() => {
      const race = snapshot;
      const player = race?.players.find(p => p.nickname === nickname);
      if (!race || !player || race.phase !== "racing") return;
      const other = race.players.find(p => p.id !== player.id);
      if (!other) return;
      const now = performance.now();
      charge = Math.max(charge, player.slipstream.charge); ready ||= player.slipstream.ready;
      revision = Math.max(revision, player.slipstream.boostRevision);
      if (player.slipstream.ready && !firstReady) firstReady = now;
      if (!player.slipstream.ready && player.slipstream.boostRevision === 0) firstReady = 0;
      if (player.slipstream.boostRemaining > 0) { firstBoost ||= now; peakBoostSpeed = Math.max(peakBoostSpeed, player.speed); }
      if (follower && firstBoost && now - firstBoost > 750) { finish(); return; }
      let nearest = 0, closest = Infinity;
      route.forEach((point, i) => {
        const distance = Math.hypot(point.position[0] - player.position[0], point.position[1] - player.position[2], point.height + .52 - player.position[1]);
        if (distance < closest) { closest = distance; nearest = i; }
      });
      const current = route[nearest], target = route[(nearest + 7) % route.length];
      const ownLane = (player.position[0] - current.position[0]) * current.normal[0] + (player.position[2] - current.position[1]) * current.normal[1];
      const leadLane = (other.position[0] - current.position[0]) * current.normal[0] + (other.position[2] - current.position[1]) * current.normal[1];
      const gap = (other.position[0] - player.position[0]) * current.tangent[0] + (other.position[2] - player.position[2]) * current.tangent[1];
      const exiting = follower && firstReady > 0 && now - firstReady > 250;
      const lane = follower ? gap < 3 && !exiting ? ownLane : leadLane + (exiting ? 1.8 : 0) : 0;
      const dx = target.position[0] + target.normal[0] * lane - player.position[0];
      const dz = target.position[1] + target.normal[1] * lane - player.position[2];
      const difference = Math.atan2(-dx, -dz) - player.yaw;
      const error = Math.atan2(Math.sin(difference), Math.cos(difference));
      const speed = Math.max(4, Math.abs(player.speed));
      const steer = Math.max(-1, Math.min(1, -2 * speed * Math.sin(error) / (Math.max(1, Math.hypot(dx, dz)) * 1.95 * Math.min(1, speed / 9))));
      const targetSpeed = follower ? exiting ? 19.5 : gap < 4 ? 7 : Math.max(10, Math.min(17, other.speed + (gap - 6) * .8)) : 13.2;
      if (touch) {
        window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: steer * 28, gamma: steer * 28 }));
        const brake = follower && gap < 3 && !exiting;
        if (brake !== braking) {
          braking = brake;
          document.querySelector('[data-control="brake"]')?.dispatchEvent(new PointerEvent(brake ? "pointerdown" : "pointerup", { bubbles: true, pointerId: 44, pointerType: "touch" }));
        }
      } else {
        steeringAccumulator += Math.abs(steer);
        const direction = steeringAccumulator >= 1 ? Math.sign(steer) : 0;
        if (direction) steeringAccumulator -= 1;
        key("KeyA", direction < 0); key("KeyD", direction > 0);
        key("KeyW", player.speed < targetSpeed); key("KeyS", follower && gap < 3 && !exiting);
      }
      document.documentElement.dataset.tailCharge = String(charge);
      document.documentElement.dataset.tailReady = String(ready);
      document.documentElement.dataset.tailRevision = String(revision);
    }, 25);
    const timeout = window.setTimeout(finish, 22_000);
  }), { nickname, follower, touch, eventName: TEST_SNAPSHOT_EVENT, route: getTrackData("meadow").race.RACE_ROUTE_SAMPLES });
}
