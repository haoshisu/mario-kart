import { expect, it, vi } from "vitest";
import { createPracticeTourStore } from "./practiceTourStore";
import { practiceRecordKey } from "../core/race/practiceRecords";
const best = '{"bestTotal":120,"bestLap":38}';
it("imports valid current-rule records and ignores corrupted or old-version records", () => {
  const data = new Map([[practiceRecordKey("taipei"), best], [practiceRecordKey("tainan"), "broken"], ["kart-lab:practice:v1:rules-0:meadow:3", best]]);
  const store = createPracticeTourStore(() => ({ getItem: key => data.get(key) ?? null }));
  store.refresh();
  expect(store.getSnapshot()).toEqual({ loaded: true, unavailable: false, records: { taipei: { bestTotal: 120, bestLap: 38 } } });
});
it("caches snapshots and updates only on changes, including deletion", () => {
  const data = new Map([[practiceRecordKey("taipei"), best]]);
  const getItem = vi.fn((key: string) => data.get(key) ?? null);
  const store = createPracticeTourStore(() => ({ getItem }));
  const notify = vi.fn(); const unsubscribe = store.subscribe(notify);
  store.refresh(); const snapshot = store.getSnapshot();
  store.getSnapshot(); expect(getItem).toHaveBeenCalledTimes(13);
  store.refresh(); expect(store.getSnapshot()).toBe(snapshot); expect(notify).toHaveBeenCalledTimes(1);
  data.clear(); store.refresh(); expect(store.getSnapshot().records).toEqual({}); expect(notify).toHaveBeenCalledTimes(2);
  unsubscribe(); data.set(practiceRecordKey("tainan"), best); store.refresh(); expect(notify).toHaveBeenCalledTimes(2);
});
it("reports denied reads and recovers when storage becomes available", () => {
  let denied = true;
  const store = createPracticeTourStore(() => { if (denied) throw new Error("denied"); return { getItem: () => null }; });
  store.refresh(); expect(store.getSnapshot()).toMatchObject({ loaded: true, unavailable: true });
  denied = false; store.refresh(); expect(store.getSnapshot().unavailable).toBe(false);
});
