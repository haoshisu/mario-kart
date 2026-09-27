import { TRACK_CONFIG } from "../../track/trackConfig";

export const RACE_CONFIG = {
  totalLaps: 3,
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
