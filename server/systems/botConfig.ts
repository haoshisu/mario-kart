export const BOT_CONFIG = {
  count: 3,
  lookAheadSamples: 7,
  laneOffsets: [-1.4, 0, 1.4],
  // Tactical item checks run several times per second; see botTactics.ts.
  itemDecisionTicks: 6,
  minimumSteeringSpeed: 4,
  // Close to the human top speed (17 m/s) so CPUs can actually race.
  cruiseSpeed: 16.3,
  cornerSpeed: 11,
  recoverySpeed: 4,
  obstacleLookAhead: 8,
  passingLane: 1.7,
  passingClearance: 1.8,
  draft: { passingOffset: 1.8, edgeClearance: 1, holdMargin: 1.5 },
  /** Catch-up pacing against the leading human, in metres of race distance. */
  // Far-ahead CPUs ease off hard so a human is never racing an empty road.
  pace: { maximumBonus: 3.2, fullBonusGap: 70, maximumPenalty: 6, fullPenaltyGap: 90, deadZone: 8 },
  items: {
    straightSteer: .35, boostHold: 4,
    shieldThreatDistance: 18, shieldHold: 8,
    trapThreatDistance: 22, trapAlignment: .75, trapHold: 12,
    discRange: 35, discAlignment: .96, orbHold: 15, discHold: 15,
    heightTolerance: 2,
  },
  drift: { enterSteer: .55, exitSteer: .18, minimumSpeed: 9, maximumError: .7, chargeSteer: .3, releaseMargin: .1 },
} as const;
