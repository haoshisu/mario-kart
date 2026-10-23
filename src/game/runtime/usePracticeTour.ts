import { useEffect, useState, useSyncExternalStore } from "react";
import { createPracticeTourStore, EMPTY_PRACTICE_TOUR, PRACTICE_RECORD_SAVED } from "./practiceTourStore";

export function usePracticeTour() {
  const [store] = useState(() => createPracticeTourStore(() => localStorage));
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_PRACTICE_TOUR);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("kart-lab:practice:")) store.refresh();
    };
    window.addEventListener("storage", changed);
    window.addEventListener(PRACTICE_RECORD_SAVED, store.refresh);
    store.refresh();
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener(PRACTICE_RECORD_SAVED, store.refresh);
    };
  }, [store]);
  return view;
}
