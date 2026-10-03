import { NETWORK_CONFIG } from "./networkConfig";

export const SERVER_STARTUP_TIMEOUT_MS = 90_000;

export function serverHealthUrl(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol === "wss:") url.protocol = "https:";
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("遊戲伺服器網址必須使用 HTTP(S) 或 WS(S)。");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/health`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

// Retry only the read-only health request. Retrying room creation could create
// multiple rooms when a successful response is lost during a cold start.
export async function waitForGameServer(endpoint: string, signal: AbortSignal) {
  const url = serverHealthUrl(endpoint);
  const deadline = AbortSignal.timeout(SERVER_STARTUP_TIMEOUT_MS);
  const lifetime = AbortSignal.any([signal, deadline]);
  try {
    while (!lifetime.aborted) {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.any([lifetime, AbortSignal.timeout(8_000)]),
        });
        if (response.ok) {
          const health: unknown = await response.json();
          if (typeof health === "object" && health !== null &&
            "ok" in health && health.ok === true &&
            "roomType" in health && health.roomType === NETWORK_CONFIG.roomType) return;
        }
      } catch {
        lifetime.throwIfAborted();
      }
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          lifetime.removeEventListener("abort", abort);
          resolve();
        };
        const timer = setTimeout(finish, 2_000);
        const abort = () => {
          clearTimeout(timer);
          lifetime.removeEventListener("abort", abort);
          reject(lifetime.reason);
        };
        lifetime.addEventListener("abort", abort, { once: true });
        if (lifetime.aborted) abort();
      });
    }
    lifetime.throwIfAborted();
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("伺服器啟動逾時或暫時無法連線，請稍後重新建立房間。");
  }
}
