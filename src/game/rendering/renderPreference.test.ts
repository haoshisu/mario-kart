import { expect, it, vi } from "vitest";
import { createRenderPreference, parseRenderQuality, RENDER_QUALITY_KEY } from "./renderPreference";
it("defers storage until mount and restores the preference before ready", () => {
  const getItem = vi.fn(() => "low"), setItem = vi.fn();
  const preference = createRenderPreference("standard", () => ({ getItem, setItem }));
  expect(preference.getSnapshot()).toMatchObject({ quality: "standard", ready: false });
  expect(getItem).not.toHaveBeenCalled();
  preference.load(); preference.load();
  expect(getItem).toHaveBeenCalledExactlyOnceWith(RENDER_QUALITY_KEY);
  expect(preference.getSnapshot()).toEqual({ quality: "low", ready: true, unavailable: false });
  expect(preference.getServerSnapshot().ready).toBe(false);
  expect(setItem).not.toHaveBeenCalled();
});
it.each([null, "", "ultra", "true", '{}'])("invalid saved preference %s keeps the device default", value => {
  const preference = createRenderPreference("low", () => ({ getItem: () => value, setItem: () => {} }));
  preference.load(); expect(preference.getSnapshot().quality).toBe("low");
  expect(parseRenderQuality(value)).toBeNull();
});
it("persists explicit selections and honors standard over a low default", () => {
  let saved = "low";
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  const preference = createRenderPreference("standard", () => storage);
  preference.load(); preference.select("standard");
  const reloaded = createRenderPreference("low", () => storage);
  reloaded.load(); expect(reloaded.getSnapshot().quality).toBe("standard");
});
it("denied reads and writes do not prevent session-only switching", () => {
  const preference = createRenderPreference("standard", () => { throw new Error("denied"); });
  preference.load(); preference.select("low");
  expect(preference.getSnapshot()).toEqual({ quality: "low", ready: true, unavailable: true });
});
it("failed writes still apply quality and later saves can recover", () => {
  let denied = true;
  const preference = createRenderPreference("standard", () => ({ getItem: () => null, setItem: () => { if (denied) throw new Error("quota"); } }));
  preference.load(); preference.select("low"); expect(preference.getSnapshot().unavailable).toBe(true);
  denied = false; preference.select("standard"); expect(preference.getSnapshot().unavailable).toBe(false);
});
it("notifies mounted consumers and cleans up subscriptions", () => {
  const preference = createRenderPreference("standard", () => ({ getItem: () => null, setItem: () => {} }));
  const notify = vi.fn(); const unsubscribe = preference.subscribe(notify);
  preference.load(); expect(notify).toHaveBeenCalledTimes(1);
  unsubscribe(); preference.select("low"); expect(notify).toHaveBeenCalledTimes(1);
});
