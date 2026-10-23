import type { CharacterId } from "../../src/game/entities/characters";
import type { StuntState } from "../../src/game/core/stunts/stuntSystem";
import type { RaceState } from "../../src/game/core/race/raceTypes";
import type { KartSimulationState } from "../../src/game/core/kart/kartTypes";
import type { SlipstreamState } from "../../src/game/core/kart/slipstreamSystem";
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
  characterId: CharacterId;
  connection: ParticipantConnection;
  status: PlayerRaceStatus;
  kart: KartSimulationState;
  slipstream: SlipstreamState;
  stunt: StuntState;
  race: RaceState;
  lateralSpeed: number;
  wallReboundRemaining: number;
  spinOutRemaining: number;
  impactRevision: number;
  impactKind: ImpactKind;
  collisionCooldown: number;
  rank: number;
};
