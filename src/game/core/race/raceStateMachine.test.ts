import { describe, expect, it } from "vitest";
import { battleLapsForLength, RACE_CONFIG } from "./raceConfig";
import {
  createInitialRaceState,
  getCountdownCue,
  transitionRaceState,
} from "./raceStateMachine";

describe("raceStateMachine", () => {
  it("accepts only legal phase transitions", () => {
    const idle = createInitialRaceState();
    const illegalFinish = transitionRaceState(idle, "FINISH");
    expect(illegalFinish.transitioned).toBe(false);
    expect(illegalFinish.state).toBe(idle);

    const countdown = transitionRaceState(idle, "START");
    expect(countdown.transitioned).toBe(true);
    expect(countdown.state.phase).toBe("COUNTDOWN");
    expect(countdown.state.countdownRemaining).toBe(RACE_CONFIG.countdownSeconds);

    const illegalStart = transitionRaceState(countdown.state, "START");
    expect(illegalStart.transitioned).toBe(false);

    const racing = transitionRaceState(countdown.state, "COUNTDOWN_COMPLETE");
    expect(racing.state.phase).toBe("RACING");
    expect(getCountdownCue(racing.state)).toBe("GO");

    const finished = transitionRaceState({ ...racing.state, elapsedTime: 42.5 }, "FINISH");
    expect(finished.state.phase).toBe("FINISHED");
    expect(finished.state.finishTime).toBe(42.5);
  });

  it("reset clears timing, laps, and progress from every phase", () => {
    const dirty = {
      ...createInitialRaceState(),
      phase: "FINISHED" as const,
      elapsedTime: 12,
      completedLaps: 3,
      lapTimes: [4, 4, 4],
    };
    const reset = transitionRaceState(dirty, "RESET");

    expect(reset.transitioned).toBe(true);
    expect(reset.state).toEqual(createInitialRaceState());
  });
});

describe("battle lap count", () => {
  it("runs kilometre-plus courses for fewer laps and keeps the count through a reset", () => {
    expect(battleLapsForLength(650)).toBe(RACE_CONFIG.totalLaps);
    expect(battleLapsForLength(1250)).toBe(RACE_CONFIG.longTrackLaps);
    const state = createInitialRaceState(2);
    expect(state.totalLaps).toBe(2);
    expect(transitionRaceState(state, "RESET").state.totalLaps).toBe(2);
    expect(createInitialRaceState().totalLaps).toBe(RACE_CONFIG.totalLaps);
  });
});
