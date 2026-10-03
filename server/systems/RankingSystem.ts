import type { ServerPlayerState } from "../state/roomState";

const STATUS_ORDER = { finished: 0, racing: 1, waiting: 2, dnf: 3 } as const;

export function rankPlayers(players: readonly ServerPlayerState[]) {
  const ordered = [...players].sort((left, right) => {
    const statusDifference = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusDifference !== 0) {
      return statusDifference;
    }
    if (left.status === "finished" && right.status === "finished") {
      const finishDifference = (left.race.finishTime ?? Infinity) - (right.race.finishTime ?? Infinity);
      return finishDifference || left.id.localeCompare(right.id);
    }
    const progressDifference = right.race.progress.rankingScore - left.race.progress.rankingScore;
    return progressDifference || left.id.localeCompare(right.id);
  });

  ordered.forEach((player, index) => {
    player.rank = index + 1;
  });
  return ordered;
}
