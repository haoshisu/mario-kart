import type { RaceSnapshot } from "./protocol";

export const TEST_SNAPSHOT_EVENT = "kart-race-test-snapshot";

// Browser tests need the received state, not the intentionally throttled HUD.
// This observer is read-only and never sends positions or results to the server.
export function createSnapshotDiagnostics() {
  if (new URLSearchParams(window.location.search).get("e2e") !== "1") return undefined;
  return (snapshot: RaceSnapshot) => {
    window.dispatchEvent(new CustomEvent(TEST_SNAPSHOT_EVENT, { detail: snapshot }));
  };
}
