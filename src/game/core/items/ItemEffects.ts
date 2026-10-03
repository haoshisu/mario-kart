import { ITEM_CONFIG } from "./itemConfig";
import type { ItemState } from "./itemTypes";

export function createItemState(revision = 0): ItemState {
  return { held: null, reserve: null, revision, cooldown: 0, shieldRemaining: 0,
    boostRemaining: 0, lockRemaining: 0, immunityRemaining: 0 };
}

export function tickItemEffects(state: ItemState, delta: number) {
  const elapsed = Math.max(0, delta);
  state.cooldown = Math.max(0, state.cooldown - elapsed);
  state.shieldRemaining = Math.max(0, state.shieldRemaining - elapsed);
  state.boostRemaining = Math.max(0, state.boostRemaining - elapsed);
  state.lockRemaining = Math.max(0, state.lockRemaining - elapsed);
  state.immunityRemaining = Math.max(0, state.immunityRemaining - elapsed);
}

export function receiveItemHit(state: ItemState): "hit" | "shield" | "immune" {
  // Recovery protection takes precedence so it does not waste a held shield.
  if (state.immunityRemaining > 0) return "immune";
  if (state.shieldRemaining > 0) {
    state.shieldRemaining = 0;
    state.immunityRemaining = ITEM_CONFIG.recoverySeconds;
    return "shield";
  }
  state.boostRemaining = 0;
  state.lockRemaining = ITEM_CONFIG.hitLockSeconds;
  state.immunityRemaining = ITEM_CONFIG.hitLockSeconds + ITEM_CONFIG.recoverySeconds;
  return "hit";
}
