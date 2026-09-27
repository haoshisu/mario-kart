import { describe, expect, it } from "vitest";
import { sanitizeInputApplied, sanitizeInputPacket, sanitizeKartInput } from "./protocol";

describe("controller protocol validation", () => {
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

  it("validates host acknowledgements used for input feedback timing", () => {
    expect(sanitizeInputApplied({ sequence: 12, sentAt: 1234 })).toEqual({
      sequence: 12,
      sentAt: 1234,
    });
    expect(sanitizeInputApplied({ sequence: -1, sentAt: 1234 })).toBeNull();
  });
});
