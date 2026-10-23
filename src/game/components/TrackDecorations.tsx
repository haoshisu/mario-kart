import { TainanWorld } from "./TainanWorld";
import { isNewCity } from "../track/cityTracks";
import { GardenCityWorld } from "./GardenCityWorld";
import type { RefObject } from "react";
import type { SnapshotBuffer } from "../network/interpolation";
import { isTaiwanTrack } from "../track/taiwanTracks";
import { TaiwanScenery } from "./TaiwanScenery";
import { CircuitSetPieces } from "./CircuitSetPieces";
import { TracksideResidents } from "./TracksideResidents";
import { ThemedScenery } from "./ThemedScenery";
import { useTrack } from "../track/TrackContext";
import { MeadowScenery } from "./MeadowScenery";
import { MeadowParkScenery } from "./MeadowParkScenery";
import { ThemeParkEnvironment } from "./ThemeParkEnvironment";

/** Each world owns its scenery; decorative solids never define the race route. */
export function TrackDecorations({ snapshotsRef }: { snapshotsRef?: RefObject<SnapshotBuffer> }) {
  const track = useTrack();
  if (track.id === "tainan") return <TainanWorld />;
  if (isNewCity(track.id)) return <GardenCityWorld id={track.id} />;
  if (isTaiwanTrack(track.id)) return <TaiwanScenery id={track.id} snapshotsRef={snapshotsRef} />;
  if (track.id === "meadow") return <><MeadowParkScenery /><MeadowScenery themed /></>;
  return <><ThemeParkEnvironment /><CircuitSetPieces />{track.id === "forest" || track.id === "clockwork" || track.id === "volcano" ? null : <ThemedScenery />}<TracksideResidents /></>;
}
