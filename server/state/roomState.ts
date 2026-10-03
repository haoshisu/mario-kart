import type { RaceState } from "../../src/game/core/race/raceTypes";
import type { KartSimulationState } from "../../src/game/core/kart/kartTypes";
import type {
  ParticipantConnection,
  PlayerRaceStatus,
  ImpactKind,
} from "../../src/game/network/protocol";
import type { PlayerColor } from "../../src/game/network/networkConfig";

export type ServerPlayerState = {
  id: string;
  nickname: string;
  color: PlayerColor;
  connection: ParticipantConnection;
  status: PlayerRaceStatus;
  kart: KartSimulationState;
  race: RaceState;
  lateralSpeed: number;
  wallReboundRemaining: number;
  spinOutRemaining: number;
  impactRevision: number;
  impactKind: ImpactKind;
  collisionCooldown: number;
  rank: number;
};
