import { createServer as createHttpServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import RAPIER from "@dimforge/rapier3d-compat";
import { NETWORK_CONFIG } from "../src/game/network/networkConfig";
import { RaceRoom } from "./rooms/RaceRoom";
import { allowedOrigin, operationsSnapshot } from "./operations";

type HttpRequest = {
  headers: { origin?: string };
  method?: string;
};

type HttpResponse = {
  header: (name: string, value: string) => void;
  sendStatus: (status: number) => void;
  json: (body: unknown) => void;
};

let rapierReady: Promise<void> | null = null;

export async function createGameServer() {
  rapierReady ??= RAPIER.init();
  await rapierReady;
  const httpServer = createHttpServer();
  const transport = new WebSocketTransport({
    server: httpServer,
    pingInterval: NETWORK_CONFIG.heartbeatIntervalMs,
    pingMaxRetries: NETWORK_CONFIG.heartbeatMaxRetries,
    maxPayload: 4 * 1_024,
    verifyClient: (info, done) => done(allowedOrigin(info.origin), 403, "Origin denied"),
  });
  const gameServer = new Server({
    greet: false,
    transport,
    express: (app) => {
      app.use((request: HttpRequest, response: HttpResponse, next: () => void) => {
        if (!allowedOrigin(request.headers.origin)) {
          response.sendStatus(403);
          return;
        }
        response.header("Access-Control-Allow-Origin", request.headers.origin ?? "*");
        response.header("Vary", "Origin");
        response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        if (request.method === "OPTIONS") {
          response.sendStatus(204);
          return;
        }
        next();
      });
      app.get("/health", (_request: HttpRequest, response: HttpResponse) => {
        response.header("Cache-Control", "no-store");
        response.json({ ok: true, roomType: NETWORK_CONFIG.roomType, ...operationsSnapshot() });
      });
    },
  });

  gameServer.define(NETWORK_CONFIG.roomType, RaceRoom);
  return { gameServer, httpServer };
}
