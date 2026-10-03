export const NETWORK_CONFIG = {
  protocolVersion: 9,
  roomType: "race",
  serverPort: 2567,
  minimumPlayers: 2,
  maximumPlayers: 4,
  inputRateHz: 20,
  inputTimeoutMs: 250,
  inputMinimumIntervalMs: 30,
  inputSendMinimumIntervalMs: 35,
  simulationRateHz: 60,
  snapshotRateHz: 20,
  interpolationDelayMs: 50,
  maximumExtrapolationMs: 100,
  teleportDistance: 5,
  sharedCamera: {
    minimumDistance: 25,
    framingPadding: 3,
    followFrequency: 8,
    farPlayerDistance: 24,
  },
  heartbeatIntervalMs: 3_000,
  heartbeatMaxRetries: 2,
  reconnectSeconds: 8,
  maxMessagesPerSecond: 50,
  nicknameMaxLength: 16,
  latencyReportMinimumIntervalMs: 1_000,
  startGrid: {
    distanceBehindLine: 1.8,
    laneSpacing: 1.65,
  },
  collision: {
    colliderHalfWidth: 0.58,
    heavyImpactSpeed: 8,
    speedRetention: 0.56,
    heavySpeedRetention: 0.32,
    eventCooldownSeconds: 0.35,
  },
} as const;

// A browser can observe an outage before the server's heartbeat expires.
// Keep retrying through detection plus the server-owned reservation window.
export const CLIENT_RECONNECT_TIMEOUT_MS = NETWORK_CONFIG.heartbeatIntervalMs *
  (NETWORK_CONFIG.heartbeatMaxRetries + 1) + NETWORK_CONFIG.reconnectSeconds * 1_000;

export const PLAYER_COLORS = ["coral", "sun", "mint", "sky"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const PLAYER_COLOR_VALUES: Readonly<Record<PlayerColor, string>> = {
  coral: "#f25f5c",
  sun: "#f6bd60",
  mint: "#70c1a3",
  sky: "#4ea8de",
};
