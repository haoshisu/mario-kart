import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORK_CONFIG } from "./networkConfig";
import { serverHealthUrl, waitForGameServer } from "./serverReadiness";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("server readiness", () => {
  it("maps websocket endpoints to read-only health URLs", () => {
    expect(serverHealthUrl("wss://race.example/game/?token=no#hash")).toBe("https://race.example/game/health");
    expect(serverHealthUrl("ws://localhost:2567")).toBe("http://localhost:2567/health");
    expect(() => serverHealthUrl("file:///tmp/server")).toThrow();
  });

  it("waits through cold-start HTML before accepting the game server", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("starting", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true, roomType: NETWORK_CONFIG.roomType }));
    vi.stubGlobal("fetch", fetcher);
    const waiting = waitForGameServer("https://race.example", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2_000);
    await waiting;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cancels retry timers when the user closes or leaves", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const waiting = waitForGameServer("https://race.example", controller.signal);
    const rejected = expect(waiting).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
