import type { RaceSnapshot } from "../network/protocol";

export type RaceSound = "countdown" | "go" | "finish" | "pickup" | "use" | "hit" | "immune" | "boost" | "collision" | "drift1" | "drift2" | "drift3" | "crossing" | "draftReady" | "draftBoost";

export class RaceSoundCues {
  private phase: RaceSnapshot["phase"] | null = null;
  private countdown = -1;
  private lastEvent = 0;
  private impacts = new Map<string, number>();

  collect(snapshot: RaceSnapshot): RaceSound[] {
    const sounds: RaceSound[] = [];
    const first = this.phase === null;
    const countdown = Math.ceil(snapshot.countdownRemaining);
    if (snapshot.phase === "countdown" && countdown !== this.countdown) sounds.push("countdown");
    if (snapshot.phase === "racing" && this.phase === "countdown") sounds.push("go");
    if (snapshot.phase === "finished" && this.phase !== "finished" && !first) sounds.push("finish");
    for (const event of snapshot.items.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (!first && event.kind !== "respawn") sounds.push(event.kind);
    }
    for (const player of snapshot.players) {
      const previous = this.impacts.get(player.id);
      if (previous !== undefined && player.impactRevision > previous && player.impactKind !== "item") sounds.push("collision");
      this.impacts.set(player.id, player.impactRevision);
    }
    this.phase = snapshot.phase;
    this.countdown = countdown;
    return [...new Set(sounds)];
  }
}
