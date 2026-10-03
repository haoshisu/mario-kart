import { describe, expect, it } from "vitest";
import { NETWORK_CONFIG } from "./networkConfig";
import {
  isRoomJoinOptions,
  sanitizeInputApplied,
  sanitizeInputPacket,
  sanitizeKartInput,
  sanitizeReadyMessage,
  sanitizeItemUse,
} from "./protocol";

describe("controller protocol validation", () => {
  it("only permits supported host-selected race modes", () => {
    const options = { protocolVersion: NETWORK_CONFIG.protocolVersion, role: "host" };
    expect(isRoomJoinOptions({ ...options, mode: "solo-keyboard" })).toBe(true);
    expect(isRoomJoinOptions({ ...options, hostPlays: true })).toBe(true);
    expect(isRoomJoinOptions({ ...options, hostPlays: "true" })).toBe(false);
    expect(isRoomJoinOptions({ ...options, role: "controller", hostPlays: true })).toBe(false);
    expect(isRoomJoinOptions({ ...options, mode: "solo-phone" })).toBe(true);
    expect(isRoomJoinOptions({ ...options, mode: "bots-unlimited" })).toBe(false);
    expect(isRoomJoinOptions({ ...options, role: "controller", mode: "solo-keyboard" })).toBe(false);
  });
  it("accepts only a safe inventory revision and discards attempted ownership or item overrides", () => {
    for (const revision of [-1, 0.5, Infinity, NaN, "1", null, Number.MAX_SAFE_INTEGER + 1]) {
      expect(sanitizeItemUse({ revision })).toBeNull();
    }
    expect(sanitizeItemUse({ revision: 3, playerId: "victim", item: "trap", target: "victim" })).toEqual({ revision: 3 });
  });
  it("clamps normalized kart input at the server boundary", () => {
    expect(sanitizeKartInput({ throttle: 5, brake: -2, steer: 4, drift: true })).toEqual({
      throttle: 1,
      brake: 0,
      steer: 1,
      drift: true,
    });
  });

  it("rejects malformed and non-finite packets", () => {
    expect(sanitizeInputPacket({ sequence: 0, sentAt: 10, input: { steer: Number.NaN } })).toBeNull();
    expect(sanitizeInputPacket({ sequence: -1, sentAt: 10, input: {} })).toBeNull();
  });

  it("validates authoritative acknowledgements used for input feedback timing", () => {
    expect(sanitizeInputApplied({ sequence: 12, sentAt: 1234, serverTick: 45 })).toEqual({
      sequence: 12,
      sentAt: 1234,
      serverTick: 45,
    });
    expect(sanitizeInputApplied({ sequence: -1, sentAt: 1234, serverTick: 45 })).toBeNull();
  });

  it("enforces protocol versions and lobby ready payloads", () => {
    expect(isRoomJoinOptions({
      role: "controller",
      nickname: "Driver",
      color: "mint",
      protocolVersion: NETWORK_CONFIG.protocolVersion,
    })).toBe(true);
    expect(isRoomJoinOptions({ role: "host", protocolVersion: 1 })).toBe(false);
    expect(sanitizeReadyMessage({ ready: true })).toEqual({ ready: true });
    expect(sanitizeReadyMessage({ ready: "yes" })).toBeNull();
  });
});
