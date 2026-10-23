import { describe, expect, it } from "vitest";
import { comparePracticeFinish, parsePracticeRecord, practiceRecordKey } from "./practiceRecords";
const finish = { totalLaps: 3, completedLaps: 3, elapsedTime: 90, lapTimes: [32, 30, 28] };
describe("practice records", () => {
  it("creates the first record without claiming an improvement", () => {
    expect(comparePracticeFinish(null, finish)).toEqual({ previous: null, record: { bestTotal: 90, bestLap: 28, bestRunLaps: [32, 30, 28] }, delta: null, newTotal: false, newLap: false });
  });
  it("compares total and single lap independently", () => {
    expect(comparePracticeFinish({ bestTotal: 85, bestLap: 29 }, finish)).toMatchObject({ record: { bestTotal: 85, bestLap: 28 }, delta: 5, newTotal: false, newLap: true });
    expect(comparePracticeFinish({ bestTotal: 95, bestLap: 27 }, finish)).toMatchObject({ record: { bestTotal: 90, bestLap: 27 }, delta: -5, newTotal: true, newLap: false });
  });
  it("compares displayed hundredths, keeping equal times tied", () => {
    expect(comparePracticeFinish({ bestTotal: 90, bestLap: 28 }, { ...finish, elapsedTime: 90.001 })).toMatchObject({ delta: 0, newTotal: false, newLap: false });
  });
  it.each([
    { ...finish, completedLaps: 2 }, { ...finish, totalLaps: 2 }, { ...finish, lapTimes: [45, 45] },
    { ...finish, lapTimes: [-1, 45, 46] }, { ...finish, elapsedTime: Infinity }, { ...finish, elapsedTime: 91 },
  ])("rejects incomplete or inconsistent finishes: %j", (invalid) => { expect(comparePracticeFinish(null, invalid)).toBeNull(); });
  it.each([null, "bad JSON", "null", "[]", '{"bestTotal":0,"bestLap":1}', '{"bestTotal":90,"bestLap":91}', '{"bestTotal":"90","bestLap":30}'])("ignores invalid storage %s", raw => { expect(parsePracticeRecord(raw)).toBeNull(); });
  it("reads valid records and isolates tracks", () => {
    expect(parsePracticeRecord('{"bestTotal":90,"bestLap":28}')).toEqual({ bestTotal: 90, bestLap: 28 });
    expect(practiceRecordKey("tainan")).not.toBe(practiceRecordKey("taichung"));
  });
});

it("stores one complete reference run while preserving an independent fastest lap", () => {
  const old = { bestTotal: 100, bestLap: 20, bestRunLaps: [40, 30, 30] };
  const result = comparePracticeFinish(old, finish);
  expect(result?.record).toEqual({ bestTotal: 90, bestLap: 20, bestRunLaps: [32, 30, 28] });
  expect(result?.record.bestRunLaps).not.toBe(finish.lapTimes);
});
it("a slower run with a quicker single lap preserves the reference run", () => {
  const old = { bestTotal: 85, bestLap: 28, bestRunLaps: [28, 28, 29] };
  expect(comparePracticeFinish(old, { ...finish, lapTimes: [40, 30, 20] })?.record)
    .toEqual({ bestTotal: 85, bestLap: 20, bestRunLaps: [28, 28, 29] });
});
it("adds splits to a tied legacy result without replacing existing tie splits", () => {
  const legacy = { bestTotal: 90, bestLap: 28 };
  expect(comparePracticeFinish(legacy, finish)?.record.bestRunLaps).toEqual([32, 30, 28]);
  const reference = { ...legacy, bestRunLaps: [31, 31, 28] };
  expect(comparePracticeFinish(reference, finish)?.record.bestRunLaps).toEqual(reference.bestRunLaps);
});
it("keeps valid old totals when optional splits are corrupt", () => {
  for (const bestRunLaps of [[30, 30], [30, 30, -1], [30, 30, 31], ["30", 30, 30], null]) {
    expect(parsePracticeRecord(JSON.stringify({ bestTotal: 90, bestLap: 28, bestRunLaps }))).toEqual({ bestTotal: 90, bestLap: 28 });
  }
  expect(parsePracticeRecord('{"bestTotal":90,"bestLap":28,"bestRunLaps":[32,30,28]}')?.bestRunLaps).toEqual([32, 30, 28]);
});
