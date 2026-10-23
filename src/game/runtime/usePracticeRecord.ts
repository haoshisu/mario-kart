import { useEffect, useState, useSyncExternalStore } from "react";
import type { RaceTelemetry } from "./raceRuntime";
import type { TrackId } from "../track/trackCatalog";
import { PRACTICE_RECORD_SAVED } from "./practiceTourStore";
import { practiceRecordKey } from "../core/race/practiceRecords";
import { createPracticeRecordStore, EMPTY_PRACTICE_RECORD, type PracticeRecordView } from "./practiceRecordStore";
export type { PracticeRecordView } from "./practiceRecordStore";

export function usePracticeRecord(trackId: TrackId, race: RaceTelemetry): PracticeRecordView {
  const [store] = useState(() => createPracticeRecordStore(() => localStorage, () => window.dispatchEvent(new Event(PRACTICE_RECORD_SAVED))));
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_PRACTICE_RECORD);
  const key = practiceRecordKey(trackId);
  const finishTime = race.phase === "FINISHED" ? race.elapsedTime : null;
  const { totalLaps, completedLaps, lapTimes } = race;
  useEffect(() => {
    store.update(key, finishTime === null ? null : { totalLaps, completedLaps, lapTimes, elapsedTime: finishTime });
  }, [store, key, finishTime, totalLaps, completedLaps, lapTimes]);
  return view;
}
