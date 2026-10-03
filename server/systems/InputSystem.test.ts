import { describe, expect, it } from "vitest";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import { InputSystem } from "./InputSystem";

const packet = (sequence: number, throttle = 1) => ({
  sequence,
  sentAt: 100 + sequence,
  input: { throttle, brake: 0, steer: 0, drift: false },
});

describe("InputSystem", () => {
  it("isolates players and rejects duplicate, stale, and over-frequency frames", () => {
    const inputs = new InputSystem();
    inputs.addPlayer("one");
    inputs.addPlayer("two");
    expect(inputs.receive("one", packet(1), 100)).toBeNull();
    expect(inputs.receive("one", packet(1), 150)).toBe("duplicate");
    expect(inputs.receive("one", packet(2), 110)).toBe("rate-limited");
    expect(inputs.read("one", 120).throttle).toBe(1);
    expect(inputs.read("two", 120).throttle).toBe(0);
  });

  it("neutralizes a lost or delayed input frame after the safety timeout", () => {
    const inputs = new InputSystem();
    inputs.addPlayer("driver");
    inputs.receive("driver", packet(1), 1_000);
    expect(inputs.read("driver", 1_000 + NETWORK_CONFIG.inputTimeoutMs).throttle).toBe(1);
    expect(inputs.read("driver", 1_001 + NETWORK_CONFIG.inputTimeoutMs).throttle).toBe(0);
  });
});
