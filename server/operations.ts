import { ServerError } from "@colyseus/core";

let rooms = 0;
let tickSamples = 0;
let tickTotalMs = 0;
let tickMaxMs = 0;

export function acquireRoom() {
  const maximum = Number(process.env.MAX_ROOMS ?? 8);
  if (!Number.isInteger(maximum) || maximum < 1) throw new Error("MAX_ROOMS must be a positive integer");
  if (rooms >= maximum) throw new ServerError(429, "伺服器房間已滿，請等目前比賽結束後再試。");
  rooms += 1;
  logOperation("room-opened");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    rooms -= 1;
    logOperation("room-closed");
  };
}

export function recordTick(durationMs: number) {
  tickSamples += 1;
  tickTotalMs += durationMs;
  tickMaxMs = Math.max(tickMaxMs, durationMs);
}

export function operationsSnapshot() {
  return { rooms, tickSamples, meanTickMs: tickSamples ? tickTotalMs / tickSamples : 0, maxTickMs: tickMaxMs };
}

export function logOperation(event: "room-opened" | "room-closed" | "joined" | "left") {
  if (process.env.NODE_ENV === "production") console.log(JSON.stringify({ event, at: new Date().toISOString(), rooms }));
}

export function allowedOrigin(origin: string | undefined) {
  const configured = process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean);
  if (!configured?.length) return process.env.NODE_ENV !== "production" || !origin;
  // Platform health checks and non-browser tooling do not send Origin.
  return !origin || configured.includes(origin);
}
