import { describe, expect, it } from "vitest";
import { TRACK_IDS } from "../../track/trackCatalog";
import { getPracticeTour, TAIWAN_TOUR_TRACKS, type PracticeRecords } from "./practiceTour";
const best = { bestTotal: 120, bestLap: 38 };
const recordsFor = (ids: readonly string[]): PracticeRecords => Object.fromEntries(ids.map(id => [id, best]));
describe("practice tour", () => {
  it("starts at zero and recommends Taiwan first", () => {
    expect(getPracticeTour({}, "meadow")).toEqual({ completed: 0, total: 13, taiwanCompleted: 0, taiwanTotal: 6, nextTrack: "taipei" });
  });
  it("skips completed tracks and the currently selected track when possible", () => {
    expect(getPracticeTour({ taipei: best }, "jiufen").nextTrack).toBe("kaohsiung");
  });
  it("counts existing Taiwan records and moves on to the remaining circuits", () => {
    expect(getPracticeTour(recordsFor(TAIWAN_TOUR_TRACKS), "taichung")).toMatchObject({ completed: 6, taiwanCompleted: 6, nextTrack: "meadow" });
  });
  it("offers the current track if it is the only remaining stop", () => {
    expect(getPracticeTour(recordsFor(TRACK_IDS.filter(id => id !== "tainan")), "tainan")).toMatchObject({ completed: 12, taiwanCompleted: 5, nextTrack: "tainan" });
  });
  it("finishes the tour with no remaining recommendation", () => {
    expect(getPracticeTour(recordsFor(TRACK_IDS), "meadow")).toMatchObject({ completed: 13, taiwanCompleted: 6, nextTrack: null });
  });
});
