import { isCharacterId, type CharacterId } from "../entities/characters";
import { isTrackId, type TrackId } from "../track/trackCatalog";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import { NETWORK_CONFIG, PLAYER_COLORS, type PlayerColor } from "./networkConfig";
import type { ItemState, ItemWorldSnapshot } from "../core/items/itemTypes";
import type { DriftTier } from "../core/kart/kartConfig";
import type { SlipstreamSnapshot } from "../core/kart/slipstreamSystem";

export const ROOM_MESSAGE = {
  input: "input",
  inputApplied: "input-applied",
  roomStatus: "room-status",
  requestStatus: "request-status",
  playerReady: "player-ready",
  startRace: "start-race",
  returnLobby: "return-lobby",
  useItem: "use-item",
  rematch: "rematch",
  snapshot: "snapshot",
  latencyReport: "latency-report",
  latency: "latency",
  closeRoom: "close-room",
  roomClosed: "room-closed",
  protocolError: "protocol-error",
} as const;

export type ParticipantRole = "host" | "controller";
export type RoomMode = "multiplayer" | "solo-keyboard" | "solo-phone";
export type ParticipantConnection = "connected" | "reconnecting" | "disconnected";
export type MultiplayerPhase = "lobby" | "countdown" | "racing" | "finished";
export type PlayerRaceStatus = "waiting" | "racing" | "finished" | "dnf";
export type ImpactKind = "wall" | "kart" | "item";

export type RoomJoinOptions = Readonly<{
  role: ParticipantRole;
  nickname?: string;
  color?: PlayerColor;
  characterId?: CharacterId;
  protocolVersion: number;
  mode?: RoomMode;
  hostPlays?: boolean;
  trackId?: TrackId;
}>;

export type InputPacket = Readonly<{
  sequence: number;
  sentAt: number;
  input: KartInput;
}>;

export type InputAppliedMessage = Readonly<{
  sequence: number;
  sentAt: number;
  serverTick: number;
}>;

export type LobbyPlayer = Readonly<{
  id: string;
  nickname: string;
  color: PlayerColor;
  characterId: CharacterId;
  ready: boolean;
  connection: ParticipantConnection;
  raceStatus: PlayerRaceStatus;
  isBot: boolean;
}>;

export type RoomStatusMessage = Readonly<{
  trackId: TrackId;
  mode: RoomMode;
  host: ParticipantConnection;
  phase: MultiplayerPhase;
  players: readonly LobbyPlayer[];
  canStart: boolean;
}>;

export type ReadyMessage = Readonly<{ ready: boolean }>;

export type PlayerSnapshot = Readonly<{
  id: string;
  nickname: string;
  color: PlayerColor;
  characterId: CharacterId;
  connection: ParticipantConnection;
  status: PlayerRaceStatus;
  position: readonly [x: number, y: number, z: number];
  yaw: number;
  speed: number;
  steer: number;
  drifting: boolean;
  driftTier: DriftTier;
  turboTier: DriftTier;
  slipstream: SlipstreamSnapshot;
  spinOutRemaining: number;
  stuntProgress: number;
  impactRevision: number;
  impactKind: ImpactKind;
  completedLaps: number;
  totalLaps: number;
  checkpointIndex: number;
  raceFraction: number;
  rank: number;
  finishTime: number | null;
  item: Readonly<ItemState>;
}>;

export type RaceSnapshot = Readonly<{
  bridge?: Readonly<import("../systems/rotatingBridge").BridgeState>;
  trackId: TrackId;
  protocolVersion: number;
  tick: number;
  serverTime: number;
  phase: MultiplayerPhase;
  countdownRemaining: number;
  elapsedTime: number;
  players: readonly PlayerSnapshot[];
  items: ItemWorldSnapshot;
  finishRemaining: number | null;
}>;

export type LatencyReport = Readonly<{ rttMs: number }>;

export type ProtocolErrorMessage = Readonly<{
  code:
    | "invalid-input"
    | "rate-limited"
    | "unauthorized"
    | "room-state"
    | "not-ready"
    | "version-mismatch";
  message: string;
}>;

export type RoomClosedMessage = Readonly<{
  reason: "host-closed" | "host-left";
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clampSignedUnit(value: number) {
  return Math.min(1, Math.max(-1, value));
}

export function sanitizeKartInput(value: unknown): KartInput | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.throttle) ||
    !isFiniteNumber(value.brake) ||
    !isFiniteNumber(value.steer) ||
    typeof value.drift !== "boolean"
  ) {
    return null;
  }
  return {
    throttle: clampUnit(value.throttle),
    brake: clampUnit(value.brake),
    steer: clampSignedUnit(value.steer),
    drift: value.drift,
  };
}

export function sanitizeInputPacket(value: unknown): InputPacket | null {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 0 ||
    !isFiniteNumber(value.sentAt) ||
    value.sentAt < 0
  ) {
    return null;
  }
  const input = sanitizeKartInput(value.input);
  return input
    ? { sequence: value.sequence as number, sentAt: value.sentAt, input }
    : null;
}

export function sanitizeInputApplied(value: unknown): InputAppliedMessage | null {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 0 ||
    !isFiniteNumber(value.sentAt) ||
    value.sentAt < 0 ||
    !Number.isSafeInteger(value.serverTick) ||
    (value.serverTick as number) < 0
  ) {
    return null;
  }
  return {
    sequence: value.sequence as number,
    sentAt: value.sentAt,
    serverTick: value.serverTick as number,
  };
}

export function sanitizeReadyMessage(value: unknown): ReadyMessage | null {
  return isRecord(value) && typeof value.ready === "boolean"
    ? { ready: value.ready }
    : null;
}

export function sanitizeItemUse(value: unknown): { revision: number } | null {
  if (!isRecord(value) || typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
  return { revision: value.revision };
}

export function sanitizeLatencyReport(value: unknown): LatencyReport | null {
  if (!isRecord(value) || !isFiniteNumber(value.rttMs)) {
    return null;
  }
  return { rttMs: Math.min(5_000, Math.max(0, value.rttMs)) };
}

export function normalizeNickname(value: unknown) {
  if (typeof value !== "string") {
    return "Driver";
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.slice(0, NETWORK_CONFIG.nicknameMaxLength) || "Driver";
}

export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === "string" && PLAYER_COLORS.some((color) => color === value);
}

export function isRoomJoinOptions(value: unknown): value is RoomJoinOptions {
  return (
    isRecord(value) &&
    (value.role === "host" || value.role === "controller") &&
    (value.mode === undefined || (value.role === "host" &&
      (value.mode === "multiplayer" || value.mode === "solo-keyboard" || value.mode === "solo-phone"))) &&
    (value.hostPlays === undefined || (value.role === "host" && typeof value.hostPlays === "boolean")) &&
    (value.trackId === undefined || (value.role === "host" && isTrackId(value.trackId))) &&
    value.protocolVersion === NETWORK_CONFIG.protocolVersion &&
    (value.nickname === undefined || typeof value.nickname === "string") &&
    (value.color === undefined || isPlayerColor(value.color)) &&
    (value.characterId === undefined || isCharacterId(value.characterId))
  );
}

export function isNeutralInput(input: KartInput) {
  return (
    input.throttle === EMPTY_KART_INPUT.throttle &&
    input.brake === EMPTY_KART_INPUT.brake &&
    input.steer === EMPTY_KART_INPUT.steer &&
    input.drift === EMPTY_KART_INPUT.drift
  );
}
