import type { RaceSnapshot } from "../../network/protocol";

export type TensionCue = Readonly<{ key: string; title: string; detail: string; tone: "final" | "up" | "down" }>;

export const RACE_TENSION_CONFIG = {
  // Grid shuffles right after GO are noise; only announce settled overtakes.
  rankSettleSeconds: 4,
  finalLapSeconds: 2.6,
  rankSeconds: 1.4,
} as const;

/** Edge-detects the followed racer's final lap and overtakes from authoritative snapshots. */
export class RaceTension {
  private lap = -1;
  private rank = 0;

  update(snapshot: RaceSnapshot, playerId: string | null | undefined): TensionCue | null {
    const me = snapshot.players.find(player => player.id === playerId);
    if (snapshot.phase !== "racing" || !me || me.status !== "racing") {
      this.lap = -1; this.rank = 0;
      return null;
    }
    const previousLap = this.lap, previousRank = this.rank;
    this.lap = me.completedLaps; this.rank = me.rank;
    if (previousLap >= 0 && me.totalLaps > 1 && me.completedLaps === me.totalLaps - 1 && previousLap < me.completedLaps) {
      return { key: `final-${snapshot.tick}`, title: "最後一圈！", detail: `目前第 ${me.rank} 名・全力衝刺`, tone: "final" };
    }
    if (previousRank > 0 && me.rank !== previousRank && snapshot.elapsedTime >= RACE_TENSION_CONFIG.rankSettleSeconds) {
      const up = me.rank < previousRank;
      return { key: `rank-${snapshot.tick}`, title: up ? `超車！第 ${me.rank} 名` : `被超車・第 ${me.rank} 名`,
        detail: up ? "守住位置" : "追回來！", tone: up ? "up" : "down" };
    }
    return null;
  }
}
