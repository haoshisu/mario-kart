import { afterEach, expect, it, vi } from "vitest";
import { acquireRoom, allowedOrigin, operationsSnapshot } from "./operations";

afterEach(() => vi.unstubAllEnvs());

it("enforces an atomic room cap and releases a reservation only once", () => {
  vi.stubEnv("MAX_ROOMS", "1");
  const release = acquireRoom();
  try { expect(() => acquireRoom()).toThrow("房間已滿"); }
  finally { release(); release(); }
  expect(operationsSnapshot().rooms).toBe(0);
  const next = acquireRoom();
  next();
});

it("accepts only configured browser origins in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOWED_ORIGINS", "https://mario-kart.sshnick.com");
  expect(allowedOrigin("https://mario-kart.sshnick.com")).toBe(true);
  expect(allowedOrigin("https://mario-kart.sshnick.com.evil.example")).toBe(false);
  expect(allowedOrigin("null")).toBe(false);
  expect(allowedOrigin(undefined)).toBe(true);
});
