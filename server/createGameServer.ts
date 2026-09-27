import { createServer as createHttpServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { NETWORK_CONFIG } from "../src/game/network/networkConfig";
import { RaceRoom } from "./rooms/RaceRoom";

type HttpRequest = {
  headers: { origin?: string };
  method?: string;
};

type HttpResponse = {
  header: (name: string, value: string) => void;
  sendStatus: (status: number) => void;
  json: (body: unknown) => void;
};

export function createGameServer() {
  const httpServer = createHttpServer();
  const transport = new WebSocketTransport({
    server: httpServer,
    pingInterval: 3_000,
    pingMaxRetries: 2,
    maxPayload: 4 * 1_024,
  });
  const gameServer = new Server({
    greet: false,
    transport,
    express: (app) => {
      app.use((request: HttpRequest, response: HttpResponse, next: () => void) => {
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
        response.json({ ok: true, roomType: NETWORK_CONFIG.roomType });
      });
    },
  });

  gameServer.define(NETWORK_CONFIG.roomType, RaceRoom);
  return { gameServer, httpServer };
}
