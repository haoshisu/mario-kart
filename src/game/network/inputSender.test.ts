import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_KART_INPUT } from "../core/kart/kartTypes";
import { InputSender } from "./inputSender";
import { NETWORK_CONFIG } from "./networkConfig";

afterEach(() => vi.useRealTimers());

describe("InputSender", () => {
  it("sends a press immediately when idle and coalesces rapid changes without losing release", () => {
    vi.useFakeTimers();
    const transmit = vi.fn();
    const sender = new InputSender(transmit);
    const gas = { ...EMPTY_KART_INPUT, throttle: 1 };
    sender.send(gas);
    expect(transmit).toHaveBeenCalledWith(gas);
    sender.send({ ...gas, steer: 1 });
    sender.send(EMPTY_KART_INPUT);
    expect(transmit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(NETWORK_CONFIG.inputSendMinimumIntervalMs);
    expect(transmit).toHaveBeenLastCalledWith(EMPTY_KART_INPUT);
    expect(transmit).toHaveBeenCalledTimes(2);
    sender.dispose();
  });

  it("cancels queued input on disposal", () => {
    vi.useFakeTimers();
    const transmit = vi.fn();
    const sender = new InputSender(transmit);
    sender.send(EMPTY_KART_INPUT);
    sender.send({ ...EMPTY_KART_INPUT, throttle: 1 });
    sender.dispose();
    vi.runAllTimers();
    expect(transmit).toHaveBeenCalledTimes(1);
  });
});
