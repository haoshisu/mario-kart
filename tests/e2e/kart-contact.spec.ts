import { expect, test } from "@playwright/test";
import { TEST_SNAPSHOT_EVENT } from "../../src/game/network/snapshotDiagnostics";
import type { RaceSnapshot } from "../../src/game/network/protocol";

test("two real keyboard drivers bump apart, keep steering, and render without errors", async ({ browser, page: host }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  host.on("pageerror", error => errors.push(error.message));
  await host.goto("/game?e2e=1&stats=1");
  await host.getByRole("combobox", { name: "畫質" }).selectOption("low");
  await host.getByRole("button", { name: "建立多人賽事房間", exact: true }).click();
  const room = await host.getByTestId("room-code").textContent();
  const context = await browser.newContext();
  const guest = await context.newPage();
  guest.on("pageerror", error => errors.push(error.message));
  try {
    await guest.goto(`/controller/${room}?e2e=1&stats=1`);
    await guest.getByLabel("暱稱").fill("Contact Driver");
    await guest.getByRole("button", { name: "加入房間", exact: true }).click();
    await guest.getByRole("button", { name: "準備完成", exact: true }).click();
    await host.evaluate(eventName => {
      let normal: { x: number; z: number } | null = null;
      let initialGap = 0, maximumGap = 0, firstYaw = 0, contactTime = 0;
      const receive = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const snapshot = event.detail as RaceSnapshot;
        const guest = snapshot.players.find(p => p.nickname === "Contact Driver");
        const host = snapshot.players.find(p => p.nickname !== "Contact Driver");
        if (!guest || !host) return;
        document.documentElement.dataset.hostLower = String(host.position[2] < guest.position[2]);
        if (!normal && host.impactKind === "kart" && guest.impactKind === "kart" && host.impactRevision > 0 && guest.impactRevision > 0) {
          const dx = guest.position[0] - host.position[0], dz = guest.position[2] - host.position[2];
          initialGap = Math.hypot(dx, dz); normal = { x: dx / initialGap, z: dz / initialGap };
          maximumGap = initialGap; firstYaw = host.yaw; contactTime = snapshot.serverTime;
          document.documentElement.dataset.kartContact = "true";
        }
        if (!normal) return;
        maximumGap = Math.max(maximumGap, (guest.position[0] - host.position[0]) * normal.x + (guest.position[2] - host.position[2]) * normal.z);
        document.documentElement.dataset.contactGain = String(maximumGap - initialGap);
        document.documentElement.dataset.contactYawChange = String(Math.abs(host.yaw - firstYaw));
        document.documentElement.dataset.contactSpin = String(Math.max(host.spinOutRemaining, guest.spinOutRemaining));
        if (snapshot.serverTime - contactTime > 1200) window.removeEventListener(eventName, receive);
      };
      window.addEventListener(eventName, receive);
    }, TEST_SNAPSHOT_EVENT);
    await expect.poll(() => host.locator("html").getAttribute("data-host-lower")).not.toBeNull();
    const hostLower = await host.locator("html").getAttribute("data-host-lower") === "true";
    const hostTurn = hostLower ? "KeyD" : "KeyA", guestTurn = hostLower ? "KeyA" : "KeyD";
    await host.getByTestId("start-race").click();
    await guest.getByRole("button", { name: "切換鍵盤操作", exact: true }).click();
    await host.keyboard.down("KeyW"); await guest.keyboard.down("KeyW");
    await expect(host.getByTestId("multiplayer-runtime")).toHaveAttribute("data-phase", "racing");
    await host.keyboard.down(hostTurn); await guest.keyboard.down(guestTurn);
    await expect(host.locator("html")).toHaveAttribute("data-kart-contact", "true", { timeout: 5000 });
    await host.keyboard.up(hostTurn); await guest.keyboard.up(guestTurn);
    await expect.poll(async () => Number(await host.locator("html").getAttribute("data-contact-gain")), { intervals: [25] }).toBeGreaterThan(.1);
    await expect(host.locator("html")).toHaveAttribute("data-contact-spin", "0");
    await host.keyboard.down(hostTurn);
    await expect.poll(async () => Number(await host.locator("html").getAttribute("data-contact-yaw-change")), { intervals: [25] }).toBeGreaterThan(.03);
    await host.keyboard.up(hostTurn);
    await host.screenshot({ path: "/tmp/kart-contact-host.png" });
    await guest.screenshot({ path: "/tmp/kart-contact-guest.png" });
    expect(errors).toEqual([]);
  } finally {
    for (const page of [host, guest]) for (const key of ["KeyW", "KeyA", "KeyD"]) await page.keyboard.up(key);
    const show = host.getByRole("button", { name: "顯示 QR Code", exact: true });
    if (await show.isVisible()) await show.click();
    await host.getByRole("button", { name: "關閉房間", exact: true }).click();
    await context.close();
  }
});
