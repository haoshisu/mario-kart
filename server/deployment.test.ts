import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Client } from "@colyseus/sdk";
import { createGameServer } from "./createGameServer";
import { NETWORK_CONFIG } from "../src/game/network/networkConfig";
import { operationsSnapshot } from "./operations";

let server: Awaited<ReturnType<typeof createGameServer>>;
let endpoint = "";
beforeAll(async () => {
  vi.stubEnv("MAX_ROOMS", "1");
  vi.stubEnv("ALLOWED_ORIGINS", "https://mario-kart.sshnick.com");
  server = await createGameServer();
  await server.gameServer.listen(0, "127.0.0.1");
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Missing server port");
  endpoint = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await server?.gameServer.gracefullyShutdown(false); vi.unstubAllEnvs(); });

it("serves uncached health only to allowed browser origins", async () => {
  const allowed = await fetch(`${endpoint}/health`, { headers: { Origin: "https://mario-kart.sshnick.com" } });
  expect(allowed.status).toBe(200);
  expect(allowed.headers.get("cache-control")).toBe("no-store");
  expect(await allowed.json()).toMatchObject({ ok: true, rooms: 0 });
  const denied = await fetch(`${endpoint}/health`, { headers: { Origin: "https://attacker.example" } });
  expect(denied.status).toBe(403);
});

it("rejects a second live room and reclaims the slot after closing", async () => {
  const client = new Client(endpoint);
  const options = { role: "host", protocolVersion: NETWORK_CONFIG.protocolVersion };
  const first = await client.create(NETWORK_CONFIG.roomType, options);
  first.onMessage("*", () => undefined);
  try { await expect(client.create(NETWORK_CONFIG.roomType, options)).rejects.toThrow("房間已滿"); }
  finally { await first.leave(); }
  await vi.waitFor(() => expect(operationsSnapshot().rooms).toBe(0));
  const replacement = await client.create(NETWORK_CONFIG.roomType, options);
  replacement.onMessage("*", () => undefined);
  await replacement.leave();
  await vi.waitFor(() => expect(operationsSnapshot().rooms).toBe(0));
});
