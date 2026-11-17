import { TRACK_CONFIG } from "../../track/trackConfig";

export const RACE_CONFIG = {
  totalLaps: 3,
  // Battle races aim for about two minutes; kilometre-plus courses run fewer laps.
  // Solo practice keeps totalLaps so saved three-lap records stay comparable.
  longTrackLength: 1000,
  longTrackLaps: 2,
  countdownSeconds: 3,
  goDisplaySeconds: 0.9,
  checkpointFractions: [0.25, 0.5, 0.75] as const,
  checkpointHalfDepth: 0.7,
  checkpointExtraWidth: 0.25,
  maximumStepSeconds: 0.05,
  respawn: {
    minimumHeight: -1.5,
    maximumTrackDistance:
      TRACK_CONFIG.roadWidth / 2 +
      TRACK_CONFIG.curbWidth +
      TRACK_CONFIG.guardRail.gap +
      0.95,
    flippedUpThreshold: 0.25,
    stuckSpeed: 0.3,
    stuckSeconds: 2.75,
    minimumThrottle: 0.65,
    protectionSeconds: 0.8,
  },
} as const;

/** Lap count for authoritative (multiplayer and CPU) races on a course of this lap length in metres. */
export function battleLapsForLength(lapLength: number) {
  return lapLength > RACE_CONFIG.longTrackLength ? RACE_CONFIG.longTrackLaps : RACE_CONFIG.totalLaps;
}
