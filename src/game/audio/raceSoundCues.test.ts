import { describe, expect, it } from "vitest";
import { RaceSoundCues } from "./raceSoundCues";
import type { RaceSnapshot } from "../network/protocol";
import { NETWORK_CONFIG } from "../network/networkConfig";

const snapshot = (phase: RaceSnapshot["phase"], countdownRemaining = 0): RaceSnapshot => ({
  phase, countdownRemaining, protocolVersion: NETWORK_CONFIG.protocolVersion, trackId: "meadow", tick: 1, serverTime: 1000,
  elapsedTime: 0, players: [], items: { boxes: [], traps: [], projectiles: [], events: [] }, finishRemaining: null,
});

describe("race sound cues", () => {
  it("plays countdown, GO and finish once, including on a rematch", () => {
    const cues = new RaceSoundCues();
    expect(cues.collect(snapshot("lobby"))).toEqual([]);
    expect(cues.collect(snapshot("countdown", 3))).toEqual(["countdown"]);
    expect(cues.collect(snapshot("countdown", 2.5))).toEqual([]);
    expect(cues.collect(snapshot("countdown", 2))).toEqual(["countdown"]);
    expect(cues.collect(snapshot("racing"))).toEqual(["go"]);
    expect(cues.collect(snapshot("finished"))).toEqual(["finish"]);
    expect(cues.collect(snapshot("finished"))).toEqual([]);
    expect(cues.collect(snapshot("countdown", 3))).toEqual(["countdown"]);
    expect(cues.collect(snapshot("racing"))).toEqual(["go"]);
  });
  it("suppresses old events on reconnect and duplicates in repeated snapshots", () => {
    const cues = new RaceSoundCues();
    const state = snapshot("racing");
    const event = { id: 1, kind: "pickup", playerId: "one", sourceId: "box", item: "shield",
      position: [0, 0], tick: 1 } as const;
    expect(cues.collect({ ...state, items: { ...state.items, events: [event] } })).toEqual([]);
    const next = { ...state, items: { ...state.items, events: [event, { ...event, id: 2, kind: "use" as const }] } };
    expect(cues.collect(next)).toEqual(["use"]);
    expect(cues.collect(next)).toEqual([]);
  });
});
