import type { ItemKind } from "./itemConfig";
import type { Point2 } from "../race/raceTrack";

export type ItemState = {
  held: ItemKind | null;
  reserve: ItemKind | null;
  revision: number;
  cooldown: number;
  shieldRemaining: number;
  boostRemaining: number;
  lockRemaining: number;
  immunityRemaining: number;
};

export type ItemEventKind = "pickup" | "use" | "hit" | "immune" | "boost" | "respawn";
export type ItemEvent = Readonly<{
  id: number;
  tick: number;
  kind: ItemEventKind;
  playerId: string;
  sourceId: string;
  item: ItemKind | null;
  position: Point2;
}>;
export type ItemRacer = Readonly<{
  id: string;
  position: Point2;
  previousPosition: Point2;
  yaw: number;
  eligible: boolean;
  height?: number;
  /** Current race placement; when present, item drops are placement-weighted. */
  rank?: number;
  racerCount?: number;
}>;
export type TrapState = Readonly<{
  id: string;
  ownerId: string;
  position: Point2;
  height?: number;
  armedAt: number;
  expiresAt: number;
}>;
export type ProjectileState = {
  id: string;
  ownerId: string;
  kind: "disc" | "orb";
  position: Point2;
  yaw: number;
  height?: number;
  targetId: string | null;
  remaining: number;
};
export type ItemWorldSnapshot = Readonly<{
  boxes: readonly Readonly<{ id: string; remaining: number }>[];
  traps: readonly TrapState[];
  projectiles: readonly Readonly<ProjectileState>[];
  events: readonly ItemEvent[];
}>;
