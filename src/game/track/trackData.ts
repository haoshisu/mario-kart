import { createJumpRamps } from "../core/stunts/stuntSystem";
import { createItemPlacements } from "../core/items/itemConfig";
import { createRaceTrack } from "../core/race/raceTrack";
import { TRACK_CATALOG, type TrackId } from "./trackCatalog";
import { createTrackGeometry } from "./trackGeometry";
import { createTrackSamples } from "./trackPath";

function buildTrack(id: TrackId) {
  const definition = TRACK_CATALOG[id];
  const samples = createTrackSamples(definition.curves, definition.elevation);
  const race = createRaceTrack(samples);
  const xs = samples.map(sample => sample.position[0]), zs = samples.map(sample => sample.position[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const bounds = { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2,
    width: maxX - minX, depth: maxZ - minZ,
    viewBox: `${minX - 9} ${minZ - 9} ${maxX - minX + 18} ${maxZ - minZ + 18}` };

  return { ...definition, bounds, samples, race, geometry: createTrackGeometry(samples),
    ramps: createJumpRamps(id, race.RACE_ROUTE_SAMPLES),
    items: createItemPlacements(race.RACE_ROUTE_SAMPLES, id) };
}
export type TrackData = ReturnType<typeof buildTrack>;
const cache = new Map<TrackId, TrackData>();
/** Immutable per-course data: concurrent rooms never switch a process-wide track. */
export function getTrackData(id: TrackId = "meadow"): TrackData {
  let data = cache.get(id);
  if (!data) { data = buildTrack(id); cache.set(id, data); }
  return data;
}
