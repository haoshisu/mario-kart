import { memo, type RefObject } from "react";
import type { SnapshotBuffer } from "../network/interpolation";
import type { LobbyPlayer } from "../network/protocol";
import { Ground } from "./Ground";
import { PlayerKart } from "./PlayerKart";
import { RaceMarkers } from "./RaceMarkers";
import { SceneLights } from "./SceneLights";
import { SharedCamera } from "./SharedCamera";
import { NetworkFollowCamera } from "./NetworkFollowCamera";
import { Track } from "./Track";
import { TrackDecorations } from "./TrackDecorations";
import { ItemWorld } from "./ItemWorld";

type MultiplayerSceneProps = {
  players: readonly LobbyPlayer[];
  snapshotsRef: RefObject<SnapshotBuffer>;
  followPlayerId?: string;
};

export const MultiplayerScene = memo(function MultiplayerScene({
  players,
  snapshotsRef,
  followPlayerId,
}: MultiplayerSceneProps) {
  return (
    <>
      <SceneLights />
      <Ground />
      <Track />
      <RaceMarkers />
      <TrackDecorations />
      <ItemWorld snapshotsRef={snapshotsRef} />
      {players.map((player) => (
        <PlayerKart
          color={player.color}
          key={player.id}
          nickname={player.nickname}
          playerId={player.id}
          snapshotsRef={snapshotsRef}
        />
      ))}
      {followPlayerId ? <NetworkFollowCamera key={followPlayerId} playerId={followPlayerId} snapshotsRef={snapshotsRef} />
        : <SharedCamera snapshotsRef={snapshotsRef} />}
    </>
  );
});
