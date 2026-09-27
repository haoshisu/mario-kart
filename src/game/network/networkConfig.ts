export const NETWORK_CONFIG = {
  roomType: "race",
  serverPort: 2567,
  inputRateHz: 20,
  inputTimeoutMs: 250,
  inputMinimumIntervalMs: 30,
  reconnectSeconds: 8,
  maxMessagesPerSecond: 45,
  nicknameMaxLength: 16,
  latencyReportMinimumIntervalMs: 1_000,
} as const;

