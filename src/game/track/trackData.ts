import { createItemPlacements } from "../core/items/itemConfig";
import { createRaceTrack } from "../core/race/raceTrack";
import { TRACK_CATALOG, type TrackId } from "./trackCatalog";
import { createTrackGeometry } from "./trackGeometry";
import { createTrackSamples } from "./trackPath";

function buildTrack(id: TrackId) {
  const definition = TRACK_CATALOG[id];
  const samples = createTrackSamples(definition.curves, definition.elevation);
  const race = createRaceTrack(samples);
  return { ...definition, samples, race, geometry: createTrackGeometry(samples),
    items: createItemPlacements(race.RACE_ROUTE_SAMPLES) };
}
export type TrackData = ReturnType<typeof buildTrack>;
const cache = new Map<TrackId, TrackData>();
/** Immutable per-course data: concurrent rooms never switch a process-wide track. */
export function getTrackData(id: TrackId = "meadow"): TrackData {
  let data = cache.get(id);
  if (!data) { data = buildTrack(id); cache.set(id, data); }
  return data;
}
