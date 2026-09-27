import { describe, expect, it } from "vitest";
import { RACE_CONFIG } from "./raceConfig";
import { CHECKPOINTS } from "./raceTrack";
import { createInitialRaceState } from "./raceStateMachine";
import { applyRespawnProtection, evaluateRespawn } from "./respawnSystem";

const baseInput = {
  position: [0, 0.52, 0] as const,
  signedSpeed: 5,
  throttle: 1,
  upY: 1,
};

describe("respawnSystem", () => {
  it.each([
    ["out-of-bounds", { ...baseInput, position: [0, -2, 0] as const }, 0],
    ["flipped", { ...baseInput, upY: 0 }, 0],
    ["out-of-bounds", baseInput, RACE_CONFIG.respawn.maximumTrackDistance + 1],
  ] as const)("detects %s", (reason, input, distance) => {
    const result = evaluateRespawn(
      createInitialRaceState().respawn,
      input,
      distance,
      1 / 60,
    );
    expect(result.reason).toBe(reason);
  });

  it("detects sustained stuck input but not a brief stop", () => {
    let state = createInitialRaceState().respawn;
    const stopped = { ...baseInput, signedSpeed: 0 };
    for (let elapsed = 0; elapsed < RACE_CONFIG.respawn.stuckSeconds - 0.1; elapsed += 0.1) {
      const result = evaluateRespawn(state, stopped, 0, 0.1);
      expect(result.reason).toBeNull();
      state = result.state;
    }
    const final = evaluateRespawn(state, stopped, 0, 0.2);
    expect(final.reason).toBe("stuck");
  });

  it("returns to the latest valid checkpoint and preserves lap progress", () => {
    const race = {
      ...createInitialRaceState(),
      phase: "RACING" as const,
      completedLaps: 1,
      expectedCheckpointIndex: 2,
      lastValidMarkerId: CHECKPOINTS[1].id,
    };
    const result = applyRespawnProtection(race, "out-of-bounds");

    expect(result.respawn.pose).toEqual(CHECKPOINTS[1].respawn);
    expect(result.state.completedLaps).toBe(1);
    expect(result.state.expectedCheckpointIndex).toBe(2);
    expect(result.state.respawn.protectionRemaining).toBe(
      RACE_CONFIG.respawn.protectionSeconds,
    );
  });
});
