import { EMPTY_KART_INPUT, type KartInput } from "../../src/game/core/kart/kartTypes";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import type { InputPacket } from "../../src/game/network/protocol";

type InputState = {
  input: KartInput;
  lastSequence: number;
  lastReceivedAt: number;
};

export type InputRejection = "duplicate" | "rate-limited" | "unknown-player";

export class InputSystem {
  private readonly states = new Map<string, InputState>();

  addPlayer(playerId: string) {
    this.states.set(playerId, {
      input: EMPTY_KART_INPUT,
      lastSequence: -1,
      lastReceivedAt: 0,
    });
  }

  removePlayer(playerId: string) {
    this.states.delete(playerId);
  }

  receive(playerId: string, packet: InputPacket, now: number): InputRejection | null {
    const state = this.states.get(playerId);
    if (!state) {
      return "unknown-player";
    }
    if (packet.sequence <= state.lastSequence) {
      return "duplicate";
    }
    if (now - state.lastReceivedAt < NETWORK_CONFIG.inputMinimumIntervalMs) {
      return "rate-limited";
    }
    state.input = packet.input;
    state.lastSequence = packet.sequence;
    state.lastReceivedAt = now;
    return null;
  }

  read(playerId: string, now: number): KartInput {
    const state = this.states.get(playerId);
    if (!state || now - state.lastReceivedAt > NETWORK_CONFIG.inputTimeoutMs) {
      return EMPTY_KART_INPUT;
    }
    return state.input;
  }

  neutralize(playerId: string) {
    const state = this.states.get(playerId);
    if (state) {
      state.input = EMPTY_KART_INPUT;
      state.lastReceivedAt = 0;
    }
  }

  resetSequences(playerId: string) {
    const state = this.states.get(playerId);
    if (state) {
      state.lastSequence = -1;
      this.neutralize(playerId);
    }
  }
}
