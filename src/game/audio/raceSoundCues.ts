import type { RaceSnapshot } from "../network/protocol";
import { RaceTension } from "../core/feedback/raceTension";

export type RaceSound = "countdown" | "go" | "finish" | "pickup" | "use" | "hit" | "immune" | "boost" | "collision" | "drift1" | "drift2" | "drift3" | "crossing" | "draftReady" | "draftBoost" | "finalLap" | "rankUp" | "rankDown" | "lock";

export class RaceSoundCues {
  private phase: RaceSnapshot["phase"] | null = null;
  private countdown = -1;
  private lastEvent = 0;
  private impacts = new Map<string, number>();
  private readonly tension = new RaceTension();

  collect(snapshot: RaceSnapshot, playerId?: string | null): RaceSound[] {
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
    const cue = this.tension.update(snapshot, playerId);
    if (cue && !first) sounds.push(cue.tone === "final" ? "finalLap" : cue.tone === "up" ? "rankUp" : "rankDown");
    this.phase = snapshot.phase;
    this.countdown = countdown;
    return [...new Set(sounds)];
  }
}
