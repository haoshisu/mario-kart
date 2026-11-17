import { createTaiwanBridge, bridgeParts, bridgeBoostPads } from "./taiwanBridge";
import { courseWidth } from "./courseDesign";
import { PARK_OBSTACLE_FRACTIONS } from "./themeParks";
import { createJumpRamps } from "../core/stunts/stuntSystem";
import { createItemPlacements } from "../core/items/itemConfig";
import { createRoughZones } from "./roughZones";
import { createRaceTrack } from "../core/race/raceTrack";
import { isPlayableTrackId, TRACK_CATALOG, type TrackId } from "./trackCatalog";
import { createTrackGeometry } from "./trackGeometry";
import type { TrackSample } from "./trackPath";
import { createTrackSamples } from "./trackPath";
import { createMeadowBranches, meadowRailOpenings, type TrackBranch } from "./meadowPark";
import { TRACK_CONFIG } from "./trackConfig";
import { createThemeParkBranches, themeParkRailOpenings } from "./themeParks";

function buildTrack(id: TrackId) {
  const definition = TRACK_CATALOG[id];
  const rawSamples = createTrackSamples(definition.curves, definition.elevation).map(sample => id === "kaohsiung" ? { ...sample, bank: 0 } : sample);
  const draftRace = createRaceTrack(rawSamples);
  const ramps = createJumpRamps(id, draftRace.RACE_ROUTE_SAMPLES);
  const draftItems = createItemPlacements(draftRace.RACE_ROUTE_SAMPLES, id, ramps, [PARK_OBSTACLE_FRACTIONS[id]]);
  const placementFraction = (position: readonly [number, number]) => draftRace.RACE_ROUTE_SAMPLES.reduce((best, point) =>
    Math.hypot(point.position[0] - position[0], point.position[1] - position[1]) <
    Math.hypot(best.position[0] - position[0], best.position[1] - position[1]) ? point : best).raceProgress;
  const protectedFractions = [PARK_OBSTACLE_FRACTIONS[id], ...ramps.flatMap(ramp => [-.02, -.01, 0, .01, .02, .03, .04, .05].map(offset => placementFraction(ramp.position) + offset)),
    ...draftItems.BOOST_PADS.map(pad => placementFraction(pad.position)), ...draftItems.ITEM_ROAD_CLEARANCES.map(box => placementFraction(box.position))];
  const byProgress = new Map(draftRace.RACE_ROUTE_SAMPLES.map(point => [point.progress, point]));
  const samples: readonly TrackSample[] = rawSamples.map(point => {
    const racePoint = byProgress.get(point.progress);
    if (!racePoint) throw new Error("Missing course sample");
    return { ...point, courseProgress: racePoint.raceProgress, width: courseWidth(id, racePoint, protectedFractions) };
  });
  const mainRace = createRaceTrack(samples);
  const baseBranches: readonly TrackBranch[] = id === "meadow" ? createMeadowBranches(mainRace.RACE_ROUTE_SAMPLES) : createThemeParkBranches(id, mainRace.RACE_ROUTE_SAMPLES);
  const branches: readonly TrackBranch[] = id === "kaohsiung" ? [...baseBranches,createTaiwanBridge(mainRace.RACE_ROUTE_SAMPLES)]
    : id === "taipei" ? [...baseBranches,...createThemeParkBranches(id, mainRace.RACE_ROUTE_SAMPLES,
      { entry:.29, exit:.425, width:5.8, handle:16, side:1, name:"捷運交會內線" }).map(branch=>({...branch,id:"taipei-crossing"}))] : baseBranches;
  const items = createItemPlacements(mainRace.RACE_ROUTE_SAMPLES, id, ramps, [PARK_OBSTACLE_FRACTIONS[id]],
    branches.map(branch => [branch.entryProgress, branch.exitProgress] as const));
  const bridgeBranch = branches.find(branch=>branch.movable);
  const bridge = bridgeBranch ? { branch: bridgeBranch, ...bridgeParts(bridgeBranch) } : undefined;
  const race = createRaceTrack(samples, branches);
  const fullItems = bridgeBranch ? { ...items, BOOST_PADS: [...items.BOOST_PADS,...bridgeBoostPads(bridgeBranch)] } : items;
  const xs = samples.map(sample => sample.position[0]), zs = samples.map(sample => sample.position[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const bounds = { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2,
    width: maxX - minX, depth: maxZ - minZ,
    viewBox: `${minX - 9} ${minZ - 9} ${maxX - minX + 18} ${maxZ - minZ + 18}` };

  const ground = { centerX: bounds.centerX, centerZ: bounds.centerZ,
    width: Math.max(TRACK_CONFIG.ground.width, bounds.width + 60),
    depth: Math.max(TRACK_CONFIG.ground.depth, bounds.depth + 60),
    thickness: TRACK_CONFIG.ground.thickness };
  // Off-road apexes are part of the playable city series only.
  const roughZones = isPlayableTrackId(id) ? createRoughZones(mainRace.RACE_ROUTE_SAMPLES, [
    ...branches.map(branch => [branch.entryProgress, branch.exitProgress] as const),
    ...ramps.map(ramp => { const progress = placementFraction(ramp.position); return [progress - .02, progress + .05] as const; }),
  ]) : [];
  return { ...definition, bounds, ground, samples, race, branches, bridge, roughZones, geometry: createTrackGeometry(samples,
    { railOpenings: id === "meadow" ? meadowRailOpenings(branches, race.RACE_ROUTE_SAMPLES) : themeParkRailOpenings(id, branches, race.RACE_ROUTE_SAMPLES),
      avoidRoads: branches.map(branch => ({ samples: branch.samples, width: branch.width, closed: false })) }),
    ramps, items: fullItems };
}
export type TrackData = ReturnType<typeof buildTrack>;
const cache = new Map<TrackId, TrackData>();
/** Immutable per-course data: concurrent rooms never switch a process-wide track. */
export function getTrackData(id: TrackId = "meadow"): TrackData {
  let data = cache.get(id);
  if (!data) { data = buildTrack(id); cache.set(id, data); }
  return data;
}
