export const BRIDGE_TIMING = { open: 12, closing: 2, turning: 3, closed: 4, opening: 2, angle: Math.PI / 12 } as const;
export type BridgeState = { elapsed: number; angle: number; gateHeight: number; locked: boolean; open: boolean };
export function createBridgeState(): BridgeState {
  return { elapsed: 0, angle: 0, gateHeight: -4, locked: true, open: true };
}
const ease = (value: number) => { const t = Math.max(0,Math.min(1,value)); return t * t * (3 - 2 * t); };
/** Occupancy is authoritative. An open bridge never starts moving beneath a racer. */
export function stepBridge(state: BridgeState, delta: number, occupied: boolean) {
  const dt = Math.max(0, Math.min(delta, .05));
  const { open, closing, turning, closed, opening, angle } = BRIDGE_TIMING;
  const rotateAt = open + closing, returnAt = rotateAt + turning + closed;
  const lockAt = returnAt + turning, period = lockAt + opening;
  const next = state.elapsed + dt;
  state.elapsed = next >= open && state.elapsed <= open && occupied ? open : next % period;
  const t = state.elapsed;
  state.locked = t < rotateAt || t >= lockAt;
  state.open = t < open || t > lockAt + opening * .75;
  state.angle = t < rotateAt || t >= lockAt ? 0 : t < rotateAt + turning
    ? angle * ease((t - rotateAt) / turning) : t < returnAt ? angle : angle * (1 - ease((t - returnAt) / turning));
  state.gateHeight = t < open ? -4 : t < rotateAt ? -4 + 5.2 * ease((t - open) / Math.min(1, closing))
    : t < lockAt ? 1.2 : 1.2 - 5.2 * ease((t - lockAt) / opening);
}
