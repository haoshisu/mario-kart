import { expect, it, vi } from "vitest";
import { createPracticeRecordStore } from "./practiceRecordStore";
const finish = { totalLaps: 3, completedLaps: 3, elapsedTime: 90, lapTimes: [30, 30, 30] };
function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: vi.fn((key: string) => data.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { data.set(key, value); }) };
  return { data, storage, store: createPracticeRecordStore(() => storage) };
}
it("writes only completed races once and preserves the improvement verdict", () => {
  const { data, storage, store } = setup();
  data.set("a", JSON.stringify({ bestTotal: 100, bestLap: 35 }));
  store.update("a", null); store.update("a", null);
  expect(storage.getItem).toHaveBeenCalledTimes(1);
  expect(storage.setItem).not.toHaveBeenCalled();
  store.update("a", finish); store.update("a", finish);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().result?.newTotal).toBe(true);
  store.update("a", null);
  expect(store.getSnapshot().result).toBeNull();
  store.update("a", finish);
  expect(store.getSnapshot().result?.delta).toBe(0);
});
it("keeps track records isolated and reloads persisted data", () => {
  const { store, storage } = setup();
  store.update("a", null); store.update("a", finish); store.update("b", null);
  expect(store.getSnapshot().best).toBeNull();
  const reloaded = createPracticeRecordStore(() => storage);
  reloaded.update("a", null);
  expect(reloaded.getSnapshot().best?.bestTotal).toBe(90);
});
it("reports inaccessible storage while keeping the current finish visible", () => {
  const store = createPracticeRecordStore(() => { throw new Error("blocked"); });
  store.update("a", null);
  expect(store.getSnapshot().unavailable).toBe(true);
  store.update("a", finish);
  expect(store.getSnapshot()).toMatchObject({ best: { bestTotal: 90 }, unavailable: true });
});
it("handles write quota errors without losing the comparison", () => {
  const store = createPracticeRecordStore(() => ({ getItem: () => '{"bestTotal":100,"bestLap":35}', setItem: () => { throw new Error("quota"); } }));
  store.update("a", null); store.update("a", finish);
  expect(store.getSnapshot()).toMatchObject({ unavailable: true, result: { newTotal: true, delta: -10 } });
});
it("notifies subscribers and releases subscriptions", () => {
  const { store } = setup(); const notify = vi.fn(); const unsubscribe = store.subscribe(notify);
  store.update("a", null); expect(notify).toHaveBeenCalledTimes(1);
  unsubscribe(); store.update("a", finish); expect(notify).toHaveBeenCalledTimes(1);
});

it("does not attribute stale finished telemetry to a newly selected track", () => {
  const { store, storage } = setup();
  store.update("a", null); store.update("a", finish);
  store.update("b", finish);
  expect(store.getSnapshot().best).toBeNull();
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  store.update("b", null); store.update("b", finish);
  expect(storage.setItem).toHaveBeenCalledTimes(2);
});
it("announces a saved finish once and never announces a failed write", () => {
  const onSaved = vi.fn();
  const storage = { getItem: () => null, setItem: vi.fn() };
  const store = createPracticeRecordStore(() => storage, onSaved);
  store.update("a", null); store.update("a", finish); store.update("a", finish);
  expect(onSaved).toHaveBeenCalledTimes(1);
  storage.setItem.mockImplementation(() => { throw new Error("quota"); });
  store.update("a", null); store.update("a", finish);
  expect(onSaved).toHaveBeenCalledTimes(1);
});
it("freezes lap reference through a record update and advances it on rematch", () => {
  const { data, store } = setup();
  const original = { bestTotal: 120, bestLap: 40, bestRunLaps: [40, 40, 40] };
  data.set("a", JSON.stringify(original));
  store.update("a", null);
  // A different tab improves storage while this attempt is running.
  data.set("a", JSON.stringify({ bestTotal: 100, bestLap: 30, bestRunLaps: [35, 35, 30] }));
  store.update("a", finish);
  expect(store.getSnapshot().reference).toEqual(original);
  expect(store.getSnapshot().result?.previous?.bestTotal).toBe(100);
  expect(store.getSnapshot().best?.bestTotal).toBe(90);
  store.update("a", null);
  expect(store.getSnapshot().reference?.bestRunLaps).toEqual([30, 30, 30]);
  store.update("b", null);
  expect(store.getSnapshot().reference).toBeNull();
});
