import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import { NETWORK_CONFIG } from "./networkConfig";

export const ROOM_MESSAGE = {
  input: "input",
  inputRelay: "input-relay",
  inputApplied: "input-applied",
  inputReset: "input-reset",
  roomStatus: "room-status",
  requestStatus: "request-status",
  latencyReport: "latency-report",
  latency: "latency",
  closeRoom: "close-room",
  roomClosed: "room-closed",
  protocolError: "protocol-error",
} as const;

export type ParticipantRole = "host" | "controller";
export type ParticipantConnection = "waiting" | "connected" | "reconnecting";

export type RoomJoinOptions = Readonly<{
  role: ParticipantRole;
  nickname?: string;
}>;

export type InputPacket = Readonly<{
  sequence: number;
  sentAt: number;
  input: KartInput;
}>;

export type RelayedInputPacket = InputPacket &
  Readonly<{
    serverReceivedAt: number;
  }>;

export type InputAppliedMessage = Readonly<{
  sequence: number;
  sentAt: number;
}>;

export type RoomStatusMessage = Readonly<{
  host: ParticipantConnection;
  controller: ParticipantConnection;
  controllerNickname: string | null;
}>;

export type InputResetMessage = Readonly<{
  reason: "background" | "disconnected" | "timeout";
}>;

export type LatencyReport = Readonly<{
  rttMs: number;
}>;

export type ProtocolErrorMessage = Readonly<{
  code: "invalid-input" | "rate-limited" | "unauthorized";
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
  if (!input) {
    return null;
  }

  return {
    sequence: value.sequence as number,
    sentAt: value.sentAt,
    input,
  };
}

export function sanitizeInputApplied(value: unknown): InputAppliedMessage | null {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 0 ||
    !isFiniteNumber(value.sentAt) ||
    value.sentAt < 0
  ) {
    return null;
  }

  return { sequence: value.sequence as number, sentAt: value.sentAt };
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

export function isRoomJoinOptions(value: unknown): value is RoomJoinOptions {
  return (
    isRecord(value) &&
    (value.role === "host" || value.role === "controller") &&
    (value.nickname === undefined || typeof value.nickname === "string")
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
