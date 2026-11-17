export const NETWORK_CONFIG = {
  protocolVersion: 25,
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
    // Include the visible Kestrel tyres (0.72 centre + 0.158 half-width).
    // Rapier adds the 0.12 rounded border to this base half-width.
    colliderHalfWidth: 0.76,
    roadColliderHalfWidth: 0.58,
    groups: { roadKart: 0x00010002, road: 0x00020001, kartContact: 0x00040004 },
    heavyImpactSpeed: 8,
    // Dampen the sliding tangent, not the velocity that separates two karts.
    speedRetention: 0.94,
    heavySpeedRetention: 0.88,
    minimumClosingSpeed: 0.7,
    restitution: 0.45,
    minimumSeparationSpeed: 4.4,
    restingSeparationSpeed: 1.2,
    maximumSeparationSpeed: 8,
    reboundSeconds: 0.3,
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
