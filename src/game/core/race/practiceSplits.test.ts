import { expect, it } from "vitest";
import { comparePracticeSplits, formatPracticeDelta } from "./practiceSplits";
const reference = { bestTotal: 90, bestLap: 20, bestRunLaps: [30, 32, 28] };
it("compares completed laps against the same reference run, including cumulative gains", () => {
  expect(comparePracticeSplits(reference, [28, 35, 27])).toEqual([
    { lap: 1, lapDelta: -2, cumulativeDelta: -2 },
    { lap: 2, lapDelta: 3, cumulativeDelta: 1 },
    { lap: 3, lapDelta: -1, cumulativeDelta: 0 },
  ]);
});
it("uses displayed hundredths and does not extrapolate unfinished laps", () => {
  expect(comparePracticeSplits(reference, [30.004])).toEqual([{ lap: 1, lapDelta: 0, cumulativeDelta: 0 }]);
  expect(comparePracticeSplits(reference, [])).toEqual([]);
});
it("handles missing reference data and invalid telemetry without inventing splits", () => {
  expect(comparePracticeSplits(null, [30])).toEqual([]);
  expect(comparePracticeSplits({ bestTotal: 90, bestLap: 28 }, [30])).toEqual([]);
  for (const laps of [[30, NaN], [0], [-1], [30, 30, 30, 30]]) expect(comparePracticeSplits(reference, laps)).toEqual([]);
});
it("labels ahead, behind and tied results without relying only on color", () => {
  expect(formatPracticeDelta(-1.2)).toBe("快 1.20 秒");
  expect(formatPracticeDelta(2)).toBe("慢 2.00 秒");
  expect(formatPracticeDelta(0)).toBe("持平");
});
