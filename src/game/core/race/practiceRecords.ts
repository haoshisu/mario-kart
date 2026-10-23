import { RACE_CONFIG } from "./raceConfig";
import { NETWORK_CONFIG } from "../../network/networkConfig";
import type { TrackId } from "../../track/trackCatalog";

export type PracticeRecord = Readonly<{ bestTotal: number; bestLap: number; bestRunLaps?: readonly number[] }>;
export type PracticeFinish = Readonly<{ totalLaps: number; completedLaps: number; elapsedTime: number; lapTimes: readonly number[] }>;
export type PracticeComparison = Readonly<{
  record: PracticeRecord; previous: PracticeRecord | null; delta: number | null; newTotal: boolean; newLap: boolean;
}>;
const hundredths = (time: number) => Math.round(time * 100) / 100;
const validTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

function validRunLaps(value: unknown, total: number): value is number[] {
  return Array.isArray(value) && value.length === RACE_CONFIG.totalLaps && value.every(validTime) &&
    Math.abs(value.reduce((sum, time) => sum + time, 0) - total) <= .05;
}

// Keep different driving-rule versions and lap counts out of the same record pool.
export function practiceRecordKey(trackId: TrackId) {
  return `kart-lab:practice:v1:rules-${NETWORK_CONFIG.protocolVersion}:${trackId}:${RACE_CONFIG.totalLaps}`;
}

export function parsePracticeRecord(raw: string | null): PracticeRecord | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("bestTotal" in value) || !("bestLap" in value) ||
      !validTime(value.bestTotal) || !validTime(value.bestLap) || value.bestLap > value.bestTotal) return null;
    const laps = "bestRunLaps" in value && validRunLaps(value.bestRunLaps, value.bestTotal) ? value.bestRunLaps : undefined;
    return { bestTotal: value.bestTotal, bestLap: value.bestLap, ...(laps ? { bestRunLaps: laps } : {}) };
  } catch { return null; }
}

export function comparePracticeFinish(previous: PracticeRecord | null, finish: PracticeFinish): PracticeComparison | null {
  if (finish.totalLaps !== RACE_CONFIG.totalLaps || finish.completedLaps !== finish.totalLaps ||
    finish.lapTimes.length !== finish.totalLaps || !validTime(finish.elapsedTime) || !finish.lapTimes.every(validTime) ||
    Math.abs(finish.lapTimes.reduce((sum, time) => sum + time, 0) - finish.elapsedTime) > .05) return null;
  const total = hundredths(finish.elapsedTime), lap = hundredths(Math.min(...finish.lapTimes));
  if (!validTime(total) || !validTime(lap)) return null;
  // A tied legacy record can gain its missing splits; slower runs never replace the reference run.
  const bestRunLaps = !previous || total < previous.bestTotal || (total === previous.bestTotal && !previous.bestRunLaps)
    ? [...finish.lapTimes] : previous.bestRunLaps;
  return { previous, record: { bestTotal: Math.min(previous?.bestTotal ?? total, total), bestLap: Math.min(previous?.bestLap ?? lap, lap),
    ...(bestRunLaps ? { bestRunLaps } : {}) },
    delta: previous ? hundredths(total - previous.bestTotal) : null,
    newTotal: previous !== null && total < previous.bestTotal, newLap: previous !== null && lap < previous.bestLap };
}
