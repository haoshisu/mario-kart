import { createStuntState } from "../../src/game/core/stunts/stuntSystem";
import { describe, expect, it } from "vitest";
import { createInitialKartState } from "../../src/game/core/kart/kartPhysics";
import { createInitialRaceState } from "../../src/game/core/race/raceEngine";
import type { ServerPlayerState } from "../state/roomState";
import { rankPlayers } from "./RankingSystem";

function racer(id: string, status: ServerPlayerState["status"], score: number, finishTime: number | null) {
  const race = createInitialRaceState();
  return {
    id,
    nickname: id,
    color: "coral",
    connection: "connected",
    status,
    stunt: createStuntState(), kart: createInitialKartState(),
    race: {
      ...race,
      finishTime,
      progress: { ...race.progress, rankingScore: score },
    },
    lateralSpeed: 0, wallReboundRemaining: 0,
    spinOutRemaining: 0,
    impactRevision: 0,
    impactKind: "kart",
    collisionCooldown: 0,
    rank: 0,
  } satisfies ServerPlayerState;
}

describe("RankingSystem", () => {
  it("ranks finishes authoritatively before progress and DNF", () => {
    const players = [
      racer("dnf", "dnf", 99, null),
      racer("racing", "racing", 2.5, null),
      racer("second", "finished", 3, 24.002),
      racer("first", "finished", 3, 24.001),
    ];
    expect(rankPlayers(players).map((player) => player.id)).toEqual([
      "first",
      "second",
      "racing",
      "dnf",
    ]);
    expect(players.find((player) => player.id === "dnf")?.rank).toBe(4);
  });

  it("breaks simultaneous finish timestamps deterministically", () => {
    const players = [
      racer("beta", "finished", 3, 20),
      racer("alpha", "finished", 3, 20),
    ];
    expect(rankPlayers(players).map((player) => player.id)).toEqual(["alpha", "beta"]);
  });
});
