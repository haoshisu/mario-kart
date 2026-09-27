import { NETWORK_CONFIG } from "./networkConfig";

export function getGameServerEndpoint(location?: Pick<Location, "hostname" | "protocol">) {
  const configuredEndpoint = process.env.NEXT_PUBLIC_COLYSEUS_URL?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint.replace(/\/$/, "");
  }

  const browserLocation =
    location ?? (typeof window === "undefined" ? undefined : window.location);
  if (!browserLocation) {
    return `http://127.0.0.1:${NETWORK_CONFIG.serverPort}`;
  }

  const protocol = browserLocation.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${browserLocation.hostname}:${NETWORK_CONFIG.serverPort}`;
}

