import { describe, expect, it } from "vitest";
import { raceResultSummary, rematchUnavailableReason } from "./raceResults";
import type { PlayerSnapshot } from "../../network/protocol";

const result = (id: string, rank: number, finishTime: number | null, status: PlayerSnapshot["status"] = "finished") =>
  ({ id, nickname: id, rank, finishTime, status });

describe("authoritative race result presentation", () => {
  it("sorts snapshots without mutation and compares the local finisher to the winner", () => {
    const players = [result("me", 2, 95.25), result("first", 1, 90)];
    const summary = raceResultSummary(players, "me");
    expect(summary.ordered.map(player => player.id)).toEqual(["first", "me"]);
    expect(players[0].id).toBe("me");
    expect(summary.gap).toBe(5.25);
  });
  it("never crowns a DNF or gives a DNF a time gap", () => {
    const summary = raceResultSummary([result("a", 1, null, "dnf"), result("me", 2, null, "dnf")], "me");
    expect(summary.winner).toBeUndefined();
    expect(summary.gap).toBeNull();
  });
  it("does not fabricate a time for a missing snapshot value or spectator", () => {
    const players = [result("first", 1, 90), result("me", 2, null)];
    expect(raceResultSummary(players, "me").gap).toBeNull();
    expect(raceResultSummary(players, null).own).toBeUndefined();
  });
  it("shows zero gap for a tie and keeps authoritative rank", () => {
    const summary = raceResultSummary([result("a", 1, 90), result("me", 2, 90)], "me");
    expect(summary.own?.rank).toBe(2);
    expect(summary.gap).toBe(0);
  });
  it("explains reconnecting, missing humans and insufficient participants", () => {
    expect(rematchUnavailableReason([{ connection: "reconnecting" }], true)).toContain("重新連線");
    expect(rematchUnavailableReason([{ connection: "connected" }, { connection: "connected" }], false)).toContain("真人");
    expect(rematchUnavailableReason([{ connection: "connected" }], true)).toContain("兩位");
    expect(rematchUnavailableReason([{ connection: "connected" }, { connection: "connected" }], true)).toBeNull();
  });
});
