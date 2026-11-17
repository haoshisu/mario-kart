import { describe, expect, it } from "vitest";
import { RaceTension } from "./raceTension";
import type { RaceSnapshot } from "../../network/protocol";

const snapshot = (completedLaps: number, rank: number, elapsedTime = 30, phase: RaceSnapshot["phase"] = "racing") => ({
  phase, tick: Math.round(elapsedTime * 60), elapsedTime,
  players: [{ id: "me", status: "racing", completedLaps, totalLaps: 2, rank }],
}) as unknown as RaceSnapshot;

describe("race tension cues", () => {
  it("announces the final lap once, on the lap transition", () => {
    const tension = new RaceTension();
    expect(tension.update(snapshot(0, 2), "me")).toBeNull();
    expect(tension.update(snapshot(1, 2), "me")).toMatchObject({ tone: "final", title: "最後一圈！" });
    expect(tension.update(snapshot(1, 2), "me")).toBeNull();
  });
  it("announces settled overtakes in both directions", () => {
    const tension = new RaceTension();
    tension.update(snapshot(0, 3), "me");
    expect(tension.update(snapshot(0, 2), "me")).toMatchObject({ tone: "up" });
    expect(tension.update(snapshot(0, 4), "me")).toMatchObject({ tone: "down" });
  });
  it("ignores grid shuffles right after the start and resets between races", () => {
    const tension = new RaceTension();
    tension.update(snapshot(0, 3, 1), "me");
    expect(tension.update(snapshot(0, 1, 2), "me")).toBeNull();
    tension.update(snapshot(0, 1, 0, "finished"), "me");
    expect(tension.update(snapshot(1, 1), "me")).toBeNull();
  });
});
