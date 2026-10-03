import type { Page } from "@playwright/test";
import { getTrackData } from "../../src/game/track/trackData";
import type { TrackId } from "../../src/game/track/trackCatalog";
import type { RaceSnapshot } from "../../src/game/network/protocol";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";

export async function driveRace(page: Page, nickname: string, mode: "touch" | "keyboard", durationMs: number, lane = 0, useItems = true, trackId: TrackId = "meadow", collectItems = useItems) {
  const track = getTrackData(trackId);
  return page.evaluate(({ route, boxes, eventName, nickname, mode, durationMs, lane, useItems, collectItems }) => new Promise<{
    usedItem: boolean; status: string; laps: number; maxSnapshotGapMs: number; impacts: number; kartSpins: number; usedKinds: string[]; seenProjectiles: string[];
  }>((resolve) => {
    const usedKinds = new Set<string>(), seenProjectiles = new Set<string>();
    let usedItem = false, status = "waiting", laps = 0, impacts = 0, kartSpins = 0;
    let lastSnapshotAt = performance.now(), maxSnapshotGapMs = 0;
    let steeringAccumulator = 0, lastItemAt = -Infinity;
    const keys = new Set<string>();
    const pedals = new Map<string, boolean>();
    const key = (code: string, pressed: boolean) => {
      if (keys.has(code) === pressed) return;
      if (pressed) keys.add(code); else keys.delete(code);
      window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", { code, bubbles: true, cancelable: true }));
    };
    const pedal = (control: "throttle" | "brake", pressed: boolean) => {
      if (pedals.get(control) === pressed) return;
      pedals.set(control, pressed);
      document.querySelector(`[data-control="${control}"]`)?.dispatchEvent(new PointerEvent(pressed ? "pointerdown" : "pointerup", {
        bubbles: true, pointerId: control === "throttle" ? 40 : 44, pointerType: "touch",
      }));
    };
    const calibrate = () => {
      keys.clear(); pedals.clear();
      if (mode === "touch") window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 0 }));
    };
    const finish = () => {
      window.clearTimeout(timeout);
      window.removeEventListener(eventName, receive);
      window.removeEventListener("blur", calibrate);
      window.removeEventListener("kart-race-test-stop-drive", finish);
      for (const code of [...keys]) key(code, false);
      pedal("throttle", false); pedal("brake", false);
      resolve({ usedItem, status, laps, maxSnapshotGapMs: Math.round(maxSnapshotGapMs), impacts, kartSpins, usedKinds: [...usedKinds], seenProjectiles: [...seenProjectiles] });
    };
    const receive = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const snapshot = event.detail as RaceSnapshot;
      const player = snapshot.players.find((candidate) => candidate.nickname === nickname);
      if (!player) return;
      const now = performance.now();
      maxSnapshotGapMs = Math.max(maxSnapshotGapMs, now - lastSnapshotAt);
      lastSnapshotAt = now;
      status = player.status; laps = player.completedLaps; impacts = player.impactRevision;
      if (player.impactKind === "kart" && player.spinOutRemaining > 0) kartSpins += 1;
      for (const shot of snapshot.items.projectiles) seenProjectiles.add(shot.kind);
      for (const event of snapshot.items.events) {
        if (event.kind === "use" && event.playerId === player.id && event.item) usedKinds.add(event.item);
      }
      if (snapshot.items.events.some((entry) => entry.kind === "use" && entry.playerId === player.id)) usedItem = true;
      if (snapshot.phase === "finished") { finish(); return; }
      if (player.status !== "racing" || player.spinOutRemaining > 0 || player.item.lockRemaining > 0) return;
      const [x, , z] = player.position;
      let nearest = 0, distance = Infinity;
      route.forEach((point, index) => {
        const next = Math.hypot(point.position[0] - x, point.position[1] - z);
        if (next < distance) { distance = next; nearest = index; }
      });
      const current = route[nearest];
      let targetLane = lane;
      // Follow an available box instead of assuming that the centre line will
      // collect one. The wider circuit deliberately makes pickups a lane choice.
      if (collectItems && !player.item.reserve) {
        let nearestBox = Infinity;
        for (const box of boxes) {
          if ((snapshot.items.boxes.find((state) => state.id === box.id)?.remaining ?? 1) > 0) continue;
          const bx = box.position[0] - x, bz = box.position[1] - z;
          const forward = bx * current.tangent[0] + bz * current.tangent[1];
          if (forward < -1 || forward > 16) continue;
          const normalX = Math.cos(box.yaw), normalZ = -Math.sin(box.yaw);
          const row = route.reduce((best, sample) =>
            Math.hypot(sample.position[0] - box.position[0], sample.position[1] - box.position[1]) <
            Math.hypot(best.position[0] - box.position[0], best.position[1] - box.position[1]) ? sample : best);
          const boxLane = (box.position[0] - row.position[0]) * normalX + (box.position[1] - row.position[1]) * normalZ;
          const cost = Math.hypot(bx, bz) + Math.abs(boxLane - lane);
          if (cost < nearestBox) { nearestBox = cost; targetLane = Math.max(-2.7, Math.min(2.7, boxLane)); }
        }
      }
      for (const other of snapshot.players) {
        if (other.id === player.id || other.status !== "racing" || Math.abs(other.speed) > 4) continue;
        const forward = (other.position[0] - x) * current.tangent[0] + (other.position[2] - z) * current.tangent[1];
        const otherLane = (other.position[0] - current.position[0]) * current.normal[0] +
          (other.position[2] - current.position[1]) * current.normal[1];
        if (forward > -1 && forward < 8 && Math.abs(otherLane - targetLane) < 1.8) targetLane = otherLane < 0 ? 1.7 : -1.7;
      }
      const target = route[(nearest + 7) % route.length];
      const dx = target.position[0] + target.normal[0] * targetLane - x;
      const dz = target.position[1] + target.normal[1] * targetLane - z;
      const difference = Math.atan2(-dx, -dz) - player.yaw;
      const error = Math.atan2(Math.sin(difference), Math.cos(difference));
      const speed = Math.max(4, Math.abs(player.speed));
      const turnRate = 1.95 * Math.min(1, speed / 9);
      const steer = Math.max(-1, Math.min(1, Math.abs(error) > 1 ? -Math.sign(error)
        : -2 * speed * Math.sin(error) / (Math.max(1, Math.hypot(dx, dz)) * turnRate)));
      const targetSpeed = Math.abs(error) > 0.9 ? 4 : Math.abs(error) > 0.45 ? 9 : 14;
      if (mode === "touch") {
        window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: steer * 28 }));
        pedal("throttle", player.speed <= targetSpeed);
        pedal("brake", player.speed > targetSpeed + 1);
      } else {
        // Pulse digital steering to approximate a driver's short corrective taps.
        steeringAccumulator += Math.abs(steer);
        const direction = steeringAccumulator >= 1 ? Math.sign(steer) : 0;
        if (direction !== 0) steeringAccumulator -= 1;
        key("KeyA", direction < 0); key("KeyD", direction > 0);
        key("KeyW", player.speed <= targetSpeed); key("KeyS", player.speed > targetSpeed + 1);
      }
      if (useItems && now - lastItemAt > 700 && player.item.held && player.item.cooldown === 0) {
        const button = document.querySelector<HTMLButtonElement>('[data-testid="use-item"]');
        if (button && !button.disabled) { button.click(); lastItemAt = now; }
      }
    };
    const timeout = window.setTimeout(finish, durationMs);
    window.addEventListener("kart-race-test-stop-drive", finish);
    window.addEventListener(eventName, receive);
    window.addEventListener("blur", calibrate);
    calibrate();
  }), { route: track.race.RACE_ROUTE_SAMPLES, boxes: track.items.ITEM_BOXES, eventName: TEST_SNAPSHOT_EVENT, nickname, mode, durationMs, lane, useItems, collectItems });
}
