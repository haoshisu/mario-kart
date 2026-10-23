import type { PlayerSnapshot } from "../../network/protocol";

type ResultPlayer = Pick<PlayerSnapshot, "id" | "rank" | "status" | "finishTime" | "nickname">;

export function raceResultSummary<T extends ResultPlayer>(players: readonly T[], playerId: string | null) {
  const ordered = [...players].sort((a, b) => a.rank - b.rank);
  const winner = ordered.find(player => player.status === "finished" && player.finishTime !== null);
  const own = ordered.find(player => player.id === playerId);
  const gap = own?.status === "finished" && own.finishTime !== null && winner?.finishTime !== undefined && winner.finishTime !== null
    ? Math.max(0, own.finishTime - winner.finishTime) : null;
  return { ordered, winner, own, gap };
}

export function rematchUnavailableReason(players: readonly Pick<PlayerSnapshot, "connection">[], hasConnectedHuman: boolean) {
  if (players.some(player => player.connection === "reconnecting")) return "等待玩家重新連線後即可再玩一次。";
  if (!hasConnectedHuman) return "沒有已連線的真人玩家，請返回 Lobby 等待玩家加入。";
  if (players.filter(player => player.connection === "connected").length < 2) return "至少需要兩位已連線參賽者，請返回 Lobby 等待玩家加入。";
  return null;
}
