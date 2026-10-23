import type { TrackId } from "./trackCatalog";
import type { TrackSample } from "./trackPath";
import type { RaceRouteSample } from "../core/race/raceTrack";
import type { createSurfaceResult } from "./trackSurface";
import type { KartHandling } from "../core/kart/kartPhysics";

export type CourseMechanic = Readonly<{
  name: string; cue: string; from: number; to: number; color: string;
  handling: KartHandling;
  shortcutCue?: string;
}>;
/** Hazards occupy the left half; the contrasting right lane always offers a
 * normal-grip alternative. Shortcut interiors require the theme's handling. */
export const COURSE_MECHANICS: Readonly<Record<TrackId, CourseMechanic>> = {
  tainan: { name: "老街石磚", cue: "左側石磚減速 / 右側平順通行", from: .105, to: .155,
    color: "#d4ad86", handling: { drag: .8, grip: .85 }, shortcutCue: "窄巷石磚減速 / 留加速穿越" },
  taichung: { name: "綠丘落葉彎", cue: "左側落葉易滑 / 右側抓地穩定", from: .72, to: .775,
    color: "#c3d88e", handling: { grip: .3, steering: .82 }, shortcutCue: "內街落葉易滑 / 提早收線出彎" },
  taipei: { name: "夜市濕滑磚", cue: "WET LEFT / DRY RIGHT", from: .785, to: .83, color: "#eeb977", handling: { grip: .55 } },
  jiufen: { name: "海灣浪花", cue: "SURF LEFT / DRY RIGHT", from: .78, to: .83, color: "#87c6c9", handling: { grip: .4 } },
  kaohsiung: { name: "潮汐低棧道", cue: "TIDE LEFT / HIGH RIGHT", from: .78, to: .83, color: "#65d8cd", handling: { grip: .4 } },
  alishan: { name: "山脊側風", cue: "WIND LEFT / SHELTER RIGHT", from: .68, to: .725, color: "#e5d6a0", handling: { yawRate: .12 } },
  meadow: { name: "風車側風橋", cue: "CROSSWIND LEFT / SHELTER RIGHT", from: .235, to: .29, color: "#f9dd88", handling: { yawRate: .12 } },
  harbor: { name: "潮濕卸貨甲板", cue: "WET DECK LEFT / DRY RIGHT", from: .32, to: .39, color: "#65d8f3", handling: { grip: .4 } },
  canyon: { name: "流沙礦床", cue: "SAND LEFT / BOOST THROUGH", from: .365, to: .43, color: "#efc77d", handling: { drag: .24 } },
  aurora: { name: "鏡湖薄冰", cue: "ICE LEFT / GRIP RIGHT", from: .46, to: .525, color: "#b7f5ff", handling: { grip: .22, steering: .7 } },
  forest: { name: "盤根木棧道", cue: "ROOTS LEFT / SMOOTH RIGHT", from: .365, to: .43, color: "#b89063", handling: { drag: .13, steering: .82 } },
  clockwork: { name: "順向輸送帶", cue: "BELT LEFT / ALIGN FOR SPEED", from: .365, to: .43, color: "#82efc6", handling: { acceleration: 4, grip: .55 } },
  volcano: { name: "火山灰冷卻道", cue: "ASH LEFT / COOL RIGHT", from: .365, to: .43, color: "#f28d56", handling: { drag: .18, grip: .55 } },
};

const MISALIGNED_BELT: KartHandling = { ...COURSE_MECHANICS.clockwork.handling, acceleration: -3 };

// Distinct technical windows follow each course's bends, not a common layout.
const NARROWS: Readonly<Record<TrackId, readonly [number, number]>> = {
  tainan: [.28,.35], taichung: [.28,.35],
  taipei: [.145,.22], jiufen: [.28,.35], kaohsiung: [.145,.22], alishan: [.18,.23],
  meadow: [.335, .40], harbor: [.82, .865], canyon: [.20, .27],
  aurora: [.82, .89], forest: [.82, .87], clockwork: [.255, .32], volcano: [.82, .89],
};
export function courseWidth(id: TrackId, point: RaceRouteSample, protectedFractions: readonly number[]) {
  if (id === "taipei") {
    // Four distinct phrases, with recovery decks and launch runways left broad.
    const windows = [[.055,.105,7.2],[.13,.245,7],[.32,.43,7.4],[.735,.875,6.8]] as const;
    let width = 8.4;
    for (const [from,to,target] of windows) {
      const edge = Math.min(point.raceProgress - from, to - point.raceProgress);
      const weight = Math.max(0, Math.min(1, edge / .018));
      width = Math.min(width, 8.4 - (8.4 - target) * weight * weight * (3 - 2 * weight));
    }
    return width;
  }
  const [from, to] = NARROWS[id];
  const edge = Math.min(point.raceProgress - from, to - point.raceProgress);
  // Keep launch/landing runways, pickups, and moving-vehicle lanes full width.
  const protectedDistance = Math.min(...protectedFractions.map(fraction => {
    const difference = Math.abs(point.raceProgress - fraction);
    return Math.min(difference, 1 - difference);
  }));
  const weight = Math.max(0, Math.min(1, edge / .012, (protectedDistance - .012) / .016));
  return 8.4 - 1.4 * weight * weight * (3 - 2 * weight);
}
export function shortcutWidth(sample: TrackSample, width: number) {
  const edge = Math.min(sample.progress, 1 - sample.progress);
  const weight = Math.max(0, Math.min(1, (edge - .2) / .15));
  return width - 1.2 * weight * weight * (3 - 2 * weight);
}

export function courseHandling(id: TrackId, surface: ReturnType<typeof createSurfaceResult>, grounded: boolean, yaw?: number, seconds?: number): KartHandling | undefined {
  if (!grounded || surface.progress === undefined || surface.distance > (surface.width ?? 8.4) / 2) return;
  const mechanic = COURSE_MECHANICS[id];
  // Wet patches dry between wave cycles. Default time preserves static callers.
  if (seconds !== undefined && (id === "jiufen" || id === "kaohsiung") && seconds % 8 >= 5) return;
  const handling = id === "clockwork" && yaw !== undefined && surface.yaw !== undefined && Math.cos(yaw - surface.yaw) < .7
    ? MISALIGNED_BELT : mechanic.handling;
  if ((id === "kaohsiung" || id === "taipei") && (surface.routeIndex ?? 0) > 1) return;
  if ((surface.routeIndex ?? 0) > 0) {
    if (surface.progress > .3 && surface.progress < .7) return handling;
    return;
  }
  if (surface.progress >= mechanic.from && surface.progress <= mechanic.to && (surface.lateral ?? 0) < -.35) return handling;
}
