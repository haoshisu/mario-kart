import { surfaceOffsetHeight, sampleTrackSurface, roadOrientation } from "../../track/trackSurface";
import { RACE_ROUTE_SAMPLES, type RaceRouteSample } from "../race/raceTrack";

export const ITEM_KINDS = ["boost", "shield", "trap", "disc", "orb"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const ITEM_LABELS: Readonly<Record<ItemKind, string>> = {
  boost: "脈衝推進", shield: "光環護盾", trap: "旋流陷阱",
  disc: "直射飛盤", orb: "追蹤光球",
};

export const ITEM_DESCRIPTIONS: Readonly<Record<ItemKind, string>> = {
  boost: "短暫加速，突破車陣", shield: "抵擋一次攻擊", trap: "在車後留下旋轉陷阱",
  disc: "向車頭直射，撞到對手或護欄後消失", orb: "追擊前方近處對手；無目標時直射",
};

export const ITEM_CONFIG = {
  boxCooldown: 5,
  pickupRadius: 0.95,
  useCooldown: 0.65,
  boostSeconds: 2,
  boostAcceleration: 10,
  boostMaximumSpeed: 23,
  shieldSeconds: 8,
  hitLockSeconds: 0.8,
  recoverySeconds: 1.8,
  trapArmSeconds: 0.5,
  trapLifetime: 12,
  trapRadius: 1.05,
  trapDropDistance: 2.2,
  maximumTraps: 12,
  maximumProjectiles: 12,
  projectileSpeed: 28,
  projectileLifetime: 4,
  projectileRadius: 0.35,
  projectileHitRadius: 0.95,
  orbTargetRange: 26,
  orbForwardCone: 0.35,
  orbTurnRate: 3.5,
  padRadius: 1.25,
  padBoostSeconds: 0.9,
  padCooldown: 3,
  eventLifetime: 2,
  maximumEvents: 64,
  finishGraceSeconds: 30,
} as const;

export function createItemPlacements(route: readonly RaceRouteSample[]) {
  function routePoint(fraction: number, lane: number) {
    const sample = route[Math.round(fraction * route.length) % route.length];
    const position = [sample.position[0] + sample.normal[0] * lane, sample.position[1] + sample.normal[1] * lane] as const;
    const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
    return {
      position,
      ...roadOrientation(yaw, sampleTrackSurface(...position, route)),
      height: surfaceOffsetHeight(sample, lane),
      yaw,
    };
  }

  // Shared placement data keeps authority and visible pickups/pads aligned.
  const ITEM_BOXES = [0.08, 0.4, 0.72].flatMap((fraction, row) =>
    [-2.7, -0.9, 0.9, 2.7].map((lane, column) => ({
      id: `box-${row}-${column}`, ...routePoint(fraction, lane),
    })));
  // Optional off-centre boosts reward lining up early without forcing every kart
  // onto the same racing line. The S-bend exit requires a deliberate lane change.
  const BOOST_PADS = [[0.13, -2.4], [0.29, 2.4], [0.46, -2.4], [0.58, 2.4], [0.81, -2.4], [0.94, -2.4]].map(([fraction, lane], index) => ({
    id: `pad-${index}`, ...routePoint(fraction, lane),
  }));

  return { ITEM_BOXES, BOOST_PADS };
}
export const { ITEM_BOXES, BOOST_PADS } = createItemPlacements(RACE_ROUTE_SAMPLES);
