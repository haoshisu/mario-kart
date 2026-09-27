import { describe, expect, it } from "vitest";
import { rankRacers } from "./progressSystem";

describe("progressSystem", () => {
  it("ranks by lap, valid checkpoint section, then track progress", () => {
    const ranked = rankRacers([
      { racerId: "behind", completedLaps: 0, expectedCheckpointIndex: 2, trackFraction: 0.6 },
      { racerId: "leader", completedLaps: 1, expectedCheckpointIndex: 0, trackFraction: 0.05 },
      { racerId: "middle", completedLaps: 0, expectedCheckpointIndex: 2, trackFraction: 0.7 },
    ]);

    expect(ranked.map((racer) => racer.racerId)).toEqual(["leader", "middle", "behind"]);
  });

  it("does not reward raw progress beyond the next valid checkpoint", () => {
    const ranked = rankRacers([
      { racerId: "shortcut", completedLaps: 0, expectedCheckpointIndex: 0, trackFraction: 0.9 },
      { racerId: "valid", completedLaps: 0, expectedCheckpointIndex: 1, trackFraction: 0.3 },
    ]);

    expect(ranked[0].racerId).toBe("valid");
  });
});
