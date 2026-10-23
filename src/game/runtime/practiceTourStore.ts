import { TRACK_IDS, type TrackId } from "../track/trackCatalog";
import { parsePracticeRecord, practiceRecordKey, type PracticeRecord } from "../core/race/practiceRecords";
import type { PracticeRecords } from "../core/race/practiceTour";

export const PRACTICE_RECORD_SAVED = "kart-practice-record-saved";
export type PracticeTourView = Readonly<{ records: PracticeRecords; unavailable: boolean; loaded: boolean }>;
export const EMPTY_PRACTICE_TOUR: PracticeTourView = { records: {}, unavailable: false, loaded: false };

// Read the collection only on opening the picker or a storage change, never on game frames.
export function createPracticeTourStore(storage: () => Pick<Storage, "getItem">) {
  let snapshot = EMPTY_PRACTICE_TOUR;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(notify: () => void) { listeners.add(notify); return () => { listeners.delete(notify); }; },
    refresh() {
      const records: Partial<Record<TrackId, PracticeRecord>> = {};
      let unavailable = false;
      try {
        const source = storage();
        for (const id of TRACK_IDS) {
          const record = parsePracticeRecord(source.getItem(practiceRecordKey(id)));
          if (record) records[id] = record;
        }
      } catch { unavailable = true; }
      const next = { records, unavailable, loaded: true };
      if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
      snapshot = next;
      listeners.forEach(notify => notify());
    },
  };
}
