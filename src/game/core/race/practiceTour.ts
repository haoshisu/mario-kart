import { PLAYABLE_TRACK_IDS, type TrackId } from "../../track/trackCatalog";
import type { PracticeRecord } from "./practiceRecords";

// The tour covers every playable city; both counts track the same five courses.
const TRACK_IDS: readonly TrackId[] = PLAYABLE_TRACK_IDS;
export const TAIWAN_TOUR_TRACKS: readonly TrackId[] = PLAYABLE_TRACK_IDS;
export type PracticeRecords = Readonly<Partial<Record<TrackId, PracticeRecord>>>;

export function getPracticeTour(records: PracticeRecords, selected: TrackId) {
  const taiwanCompleted = TAIWAN_TOUR_TRACKS.filter(id => records[id]).length;
  const completed = TRACK_IDS.filter(id => records[id]).length;
  const remaining = [...TAIWAN_TOUR_TRACKS, ...TRACK_IDS.filter(id => !TAIWAN_TOUR_TRACKS.includes(id))]
    .filter(id => !records[id]);
  return { completed, total: TRACK_IDS.length, taiwanCompleted, taiwanTotal: TAIWAN_TOUR_TRACKS.length,
    nextTrack: remaining.find(id => id !== selected) ?? remaining[0] ?? null };
}
