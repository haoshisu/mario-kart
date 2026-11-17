import { routeLength, sampleAtDistance } from "../../track/trackPlacement";
import { isPlayableTrackId, type TrackId } from "../../track/trackCatalog";
import { createRoadHazards } from "./roadHazards";
import { surfaceOffsetHeight, sampleTrackSurface, roadOrientation } from "../../track/trackSurface";
import { RACE_ROUTE_SAMPLES, type RaceRouteSample } from "../race/raceTrack";
import type { JumpRamp } from "../stunts/stuntSystem";
import { createItemRows } from "./itemRows";

export const ITEM_KINDS = ["boost", "shield", "trap", "disc", "orb", "comet"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const ITEM_LABELS: Readonly<Record<ItemKind, string>> = {
  boost: "脈衝推進", shield: "光環護盾", trap: "旋流陷阱",
  disc: "直射飛盤", orb: "追蹤光球", comet: "追星彗光",
};

export const ITEM_DESCRIPTIONS: Readonly<Record<ItemKind, string>> = {
  boost: "短暫加速，突破車陣", shield: "抵擋一次攻擊", trap: "在車後留下旋轉陷阱",
  disc: "向車頭直射，撞到對手或護欄後消失", orb: "追擊前方近處對手；無目標時直射",
  comet: "鎖定第一名，預警後從天而降；護盾可抵擋",
};

export const ITEM_CONFIG = {
  boxCooldown: 2.5,
  pickupRadius: 0.95,
  useCooldown: 0.65,
  boostSeconds: 2,
  boostAcceleration: 10,
  boostMaximumSpeed: 23,
  shieldSeconds: 8,
  hitLockSeconds: 1,
  // A hit spins the kart once and keeps part of its momentum as a slide.
  hitSpeedRetention: 0.35,
  recoverySeconds: 1.8,
  trapArmSeconds: 0.5,
  trapLifetime: 12,
  trapRadius: 1.05,
  trapDropDistance: 2.2,
  maximumTraps: 12,
  maximumProjectiles: 12,
  // Leader strike: warning time gives the target a real chance to raise a shield.
  cometWarningSeconds: 1.4,
  maximumComets: 4,
  projectileSpeed: 28,
  projectileLifetime: 4,
  projectileRadius: 0.35,
  projectileHitRadius: 0.95,
  orbTargetRange: 40,
  orbForwardCone: 0.35,
  orbTurnRate: 3.5,
  padRadius: 1.25,
  padBoostSeconds: 0.9,
  padCooldown: 3,
  eventLifetime: 2,
  maximumEvents: 64,
  finishGraceSeconds: 30,
} as const;

export function createItemPlacements(route: readonly RaceRouteSample[], trackId: TrackId = "meadow", ramps: readonly JumpRamp[] = [], obstacleFractions: readonly number[] = [],
  branchRanges: readonly (readonly [number, number])[] = []) {
  function routePoint(fraction: number, lane: number) {
    const sample = sampleAtDistance(route, fraction * routeLength(route));
    const position = [sample.position[0] + sample.normal[0] * lane, sample.position[1] + sample.normal[1] * lane] as const;
    const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
    return {
      position,
      ...roadOrientation(yaw, sampleTrackSurface(...position, route)),
      height: surfaceOffsetHeight(sample, lane),
      yaw,
    };
  }

  // Keep the approved road-width clearances independent of new supply rows.
  // Reusing these anchors preserves the existing tapers and jump runways.
  const boxFractions: Record<TrackId, readonly number[]> = {
    tainan: [.08,.44,.92], taichung: [.08,.44,.92],
    taipei: [.095,.46,.89], jiufen: [.08,.44,.92], kaohsiung: [.08,.42,.92], alishan: [.08,.44,.92],
    forest: [.24,.48,.87], clockwork: [.24,.48,.87], volcano: [.24,.48,.87],
    meadow: [.2, .64, .84], harbor: [.16, .6, .86],
    canyon: [.12, .52, .84], aurora: [.18, .4, .68],
  };
  const ITEM_ROAD_CLEARANCES = boxFractions[trackId].flatMap((fraction, row) =>
    [-2.9, -1.9, -.9, .1].map((lane, column) => ({
      id: `box-${row}-${column}`, ...routePoint(fraction, trackId === "harbor" && row === 1
        ? .9 + column * .7 : trackId === "canyon" && row === 2 ? -lane : lane),
    })));
  const fractions: Record<TrackId, readonly number[]> = {
    tainan: [.08,.48,.72,.79,.86,.95], taichung: [.08,.48,.72,.79,.86,.95],
    taipei: [.245,.49,.66,.79,.865,.95], jiufen: [.08,.52,.72,.79,.86,.95], kaohsiung: [.08,.48,.72,.79,.86,.95], alishan: [.08,.69,.48,.79,.86,.95],
    forest: [.08,.38,.48,.74,.86,.95], clockwork: [.08,.38,.48,.74,.86,.95], volcano: [.08,.38,.48,.74,.86,.95],
    meadow: [.12, .44, .59, .76, .86, .95], harbor: [.12, .52, .63, .73, .86, .96],
    canyon: [.12, .46, .57, .77, .86, .95], aurora: [.12, .3, .44, .6, .79, .95],
  };
  const padLanes: Record<TrackId, readonly number[]> = {
    tainan: [-2.4,-2.4,2.4,-2.4,2.4,2.4], taichung: [-2.4,-2.4,2.4,-2.4,2.4,2.4],
    taipei: [-2.4,-2.4,2.4,-2.1,2.1,2.4], jiufen: [-2.4,-2.4,2.4,-2.4,2.4,2.4], kaohsiung: [-2.4,-2.4,2.4,-2.4,2.4,2.4], alishan: [-2.4,-2.4,2.4,-2.4,2.4,2.4],
    forest: [-2.4,2.4,-2.4,2.4,-2.4,2.4], clockwork: [-2.4,2.4,-2.4,2.4,-2.4,2.4], volcano: [-2.4,2.4,-2.4,2.4,-2.4,2.4],
    meadow: [-2.4, 2.4, -2.4, 2.4, -2.4, -2.4],
    harbor: [-2.4, 2.4, 2.4, -2.4, -2.4, 2.4],
    canyon: [-2.4, 2.4, -2.4, 2.4, 2.4, 2.4],
    aurora: [-2.4, 2.4, -2.4, 2.4, -2.4, 2.4],
  };
  const basePads = fractions[trackId].map((fraction, index) => ({ fraction, lane: padLanes[trackId][index] }));
  const length = routeLength(route);
  // The authored chain is measured in metres, independent of sample density.
  const chainStart = sampleAtDistance(route, basePads[1].fraction * length);
  const placements = [...basePads, ...[9, 18].map(distance => ({
    fraction: sampleAtDistance(route, chainStart.distance + distance).raceProgress, lane: basePads[1].lane,
  }))];
  const BOOST_PADS = placements.map(({ fraction, lane }, index) => ({
    id: `pad-${index}`, ...routePoint(fraction, lane),
  }));

  const ITEM_BOXES = createItemRows(route, ramps, obstacleFractions);
  const nearestDistance = (position: readonly [number, number]) => route.reduce((best, point) =>
    Math.hypot(point.position[0] - position[0], point.position[1] - position[1]) <
    Math.hypot(best.position[0] - position[0], best.position[1] - position[1]) ? point : best).distance;
  // Only the playable city series carries road hazards; retired courses keep their original rules.
  const ROAD_HAZARDS = isPlayableTrackId(trackId) ? createRoadHazards(route, {
    distances: [...new Set(ITEM_BOXES.map(box => box.rowDistance))].concat(BOOST_PADS.map(pad => nearestDistance(pad.position)),
      obstacleFractions.map(fraction => fraction * length)),
    rampDistances: ramps.map(ramp => nearestDistance(ramp.position)),
    progressRanges: branchRanges,
  }) : [];

  return { ITEM_BOXES, BOOST_PADS, ITEM_ROAD_CLEARANCES, ROAD_HAZARDS };
}
export const { ITEM_BOXES, BOOST_PADS } = createItemPlacements(RACE_ROUTE_SAMPLES);
