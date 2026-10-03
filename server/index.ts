import { NETWORK_CONFIG } from "../src/game/network/networkConfig";
import { createGameServer } from "./createGameServer";

async function main() {
  const port = Number(process.env.PORT ?? process.env.COLYSEUS_PORT ?? NETWORK_CONFIG.serverPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  const hostname = process.env.COLYSEUS_HOST ?? "0.0.0.0";
  const { gameServer } = await createGameServer();
  await gameServer.listen(port, hostname);
  console.log(`Kart Lab Colyseus server listening on http://${hostname}:${port}`);

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await gameServer.gracefullyShutdown(false);
    process.exit(0);
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
