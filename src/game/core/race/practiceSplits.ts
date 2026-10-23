import type { PracticeRecord } from "./practiceRecords";
export type PracticeSplit = Readonly<{ lap: number; lapDelta: number; cumulativeDelta: number }>;
const difference = (time: number, target: number) => (Math.round(time * 100) - Math.round(target * 100)) / 100;

export function comparePracticeSplits(reference: PracticeRecord | null, completedLaps: readonly number[]): PracticeSplit[] {
  const targets = reference?.bestRunLaps;
  if (!targets || completedLaps.length > targets.length || completedLaps.some(time => !Number.isFinite(time) || time <= 0)) return [];
  let elapsed = 0, targetElapsed = 0;
  return completedLaps.map((time, index) => {
    elapsed += time;
    targetElapsed += targets[index];
    return { lap: index + 1, lapDelta: difference(time, targets[index]), cumulativeDelta: difference(elapsed, targetElapsed) };
  });
}

export function formatPracticeDelta(delta: number) {
  return delta < 0 ? `快 ${(-delta).toFixed(2)} 秒` : delta > 0 ? `慢 ${delta.toFixed(2)} 秒` : "持平";
}
