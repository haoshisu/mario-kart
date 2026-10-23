import { comparePracticeFinish, parsePracticeRecord, type PracticeComparison, type PracticeFinish, type PracticeRecord } from "../core/race/practiceRecords";

export type PracticeRecordView = Readonly<{ best: PracticeRecord | null; reference: PracticeRecord | null; result: PracticeComparison | null; unavailable: boolean }>;
export const EMPTY_PRACTICE_RECORD: PracticeRecordView = { best: null, reference: null, result: null, unavailable: false };
type StorageAccess = () => Pick<Storage, "getItem" | "setItem">;

// Cache one race's verdict so subsequent telemetry and Strict Mode cannot turn a new record into a tie.
export function createPracticeRecordStore(storage: StorageAccess, onSaved?: () => void) {
  let key: string | null = null;
  let finished = false;
  let started = false;
  let snapshot = EMPTY_PRACTICE_RECORD;
  const listeners = new Set<() => void>();
  const publish = (view: PracticeRecordView) => {
    snapshot = view;
    listeners.forEach((notify) => notify());
  };
  return {
    subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
    getSnapshot: () => snapshot,
    update(nextKey: string, finish: PracticeFinish | null) {
      if (key !== nextKey) {
        key = nextKey;
        finished = false;
        started = false;
        try {
          const best = parsePracticeRecord(storage().getItem(key));
          publish({ ...EMPTY_PRACTICE_RECORD, best, reference: best });
        }
        catch { publish({ ...EMPTY_PRACTICE_RECORD, unavailable: true }); }
      }
      if (!finish) {
        started = true;
        if (finished) publish({ ...snapshot, reference: snapshot.best, result: null });
        finished = false;
        return;
      }
      // Track changes can briefly retain the previous track’s finished telemetry.
      if (finished || !started) return;
      let previous = snapshot.best;
      let unavailable = false;
      try { previous = parsePracticeRecord(storage().getItem(key)); } catch { unavailable = true; }
      const result = comparePracticeFinish(previous, finish);
      if (!result) return;
      finished = true;
      try { if (!unavailable) storage().setItem(key, JSON.stringify(result.record)); } catch { unavailable = true; }
      if (!unavailable) onSaved?.();
      publish({ best: result.record, reference: snapshot.reference, result, unavailable });
    },
  };
}
