import { describe, expect, it } from "vitest";
import { PLAYABLE_TRACK_IDS } from "../../track/trackCatalog";
import { getPracticeTour, TAIWAN_TOUR_TRACKS, type PracticeRecords } from "./practiceTour";
const best = { bestTotal: 120, bestLap: 38 };
const recordsFor = (ids: readonly string[]): PracticeRecords => Object.fromEntries(ids.map(id => [id, best]));
describe("practice tour", () => {
  it("covers exactly the five playable city courses", () => {
    expect(TAIWAN_TOUR_TRACKS).toEqual(["taipei", "jiufen", "kaohsiung", "tainan", "taichung"]);
  });
  it("starts at zero and recommends Taipei first", () => {
    expect(getPracticeTour({}, "tainan")).toEqual({ completed: 0, total: 5, taiwanCompleted: 0, taiwanTotal: 5, nextTrack: "taipei" });
  });
  it("skips completed tracks and the currently selected track when possible", () => {
    expect(getPracticeTour({ taipei: best }, "jiufen").nextTrack).toBe("kaohsiung");
  });
  it("ignores records from courses that are no longer offered", () => {
    expect(getPracticeTour(recordsFor(["meadow", "alishan"]), "taipei")).toMatchObject({ completed: 0, taiwanCompleted: 0 });
  });
  it("offers the current track if it is the only remaining stop", () => {
    expect(getPracticeTour(recordsFor(PLAYABLE_TRACK_IDS.filter(id => id !== "tainan")), "tainan")).toMatchObject({ completed: 4, taiwanCompleted: 4, nextTrack: "tainan" });
  });
  it("finishes the tour with no remaining recommendation", () => {
    expect(getPracticeTour(recordsFor(PLAYABLE_TRACK_IDS), "taipei")).toMatchObject({ completed: 5, taiwanCompleted: 5, nextTrack: null });
  });
});
