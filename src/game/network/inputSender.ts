import type { KartInput } from "../core/kart/kartTypes";
import { NETWORK_CONFIG } from "./networkConfig";

// Coalesce changes within the server's rate limit, retaining the newest multi-touch state.
export class InputSender {
  private lastSentAt = -Infinity;
  private pending: KartInput | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly transmit: (input: KartInput) => void) {}

  send(input: KartInput) {
    this.pending = input;
    const remaining = NETWORK_CONFIG.inputSendMinimumIntervalMs - (Date.now() - this.lastSentAt);
    if (remaining <= 0) {
      this.flush();
    } else if (this.timer === null) {
      this.timer = setTimeout(() => this.flush(), remaining);
    }
  }

  dispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private flush() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const input = this.pending;
    this.pending = null;
    if (!input) return;
    this.lastSentAt = Date.now();
    this.transmit(input);
  }
}
