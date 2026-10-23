import { isTaiwanTrack } from "./taiwanTracks";
import { TAIWAN_BRANCHES, TAIWAN_DISTRICTS } from "./taiwanDesign";
import { shortcutWidth } from "./courseDesign";
import type { TrackId } from "./trackCatalog";
import type { RaceRouteSample } from "../core/race/raceTrack";
import { createOpenTrackSamples } from "./openTrackPath";
import { createTrackGeometry, type RailOpening } from "./trackGeometry";
import { sampleTrackSurface } from "./trackSurface";
import type { TrackBranch } from "./meadowPark";

export type ParkDistrict = Readonly<{ from: number; to: number; title: string; name: string; color: string; cue: string }>;
function districts(edges: readonly number[], labels: readonly (readonly [string, string, string, string])[]): readonly ParkDistrict[] {
  return labels.map(([title, name, color, cue], i) => ({ from: edges[i], to: edges[i + 1], title, name, color, cue }));
}
export const THEME_PARK_DISTRICTS: Readonly<Record<Exclude<TrackId, "meadow">, readonly ParkDistrict[]>> = {
  ...TAIWAN_DISTRICTS,
  tainan: districts([0,.17,.33,.5,.67,.83,1], [["OLD TOWN","紅磚老街","#df9b73",""],["CANAL BEND","運河長彎","#7fc5b7",""],["GATE SQUARE","城樓廣場","#e2bf7e",""],["MARKET CUT","老街分流","#dc8463",""],["SUNSET LEVEE","夕照堤岸","#f0ce93",""],["LANTERN RUN","燈籠衝線","#eda46c",""]]),
  taichung: districts([0,.17,.33,.5,.67,.83,1], [["GREENWAY","綠園大道","#96d5a6",""],["ART CLIMB","展館登高","#edc694",""],["SKYLINE","天際線高架","#a1d7eb",""],["GARDEN CUT","花園捷徑","#efc4b0",""],["HILL PARK","綠丘雙彎","#b4d994",""],["LIGHT WALK","光廊衝線","#f2df9f",""]]),
  forest: districts([0,.19,.34,.5,.75,.88,1], [
    ["FIREFLY CREEK", "螢溪迎賓道", "#ffd785", "JUMP RIGHT / CRUISE CENTER"],
    ["VINE CLIMB", "藤林攀升道", "#aee881", "CLIMB / SET YOUR LINE"],
    ["CANOPY CROWN", "巨樹天空橋", "#73e5ca", "LANDMARK REVEAL / HOLD YOUR LINE"],
    ["ROOT HOLLOW", "樹根洞分流", "#e8b789", "NARROW SHORTCUT / WIDE MAIN ROAD"],
    ["RIVER BASIN", "瀑潭折返谷", "#89cffa", "DRIFT / WATCH THE ROBOT"],
    ["LANTERN GROVE", "燈果衝線道", "#ffbca2", "TURBO HOME"],
  ]),
  clockwork: districts([0,.19,.34,.5,.75,.88,1], [
    ["GEAR FAIR", "齒輪迎賓道", "#ffc978", "JUMP RIGHT / CRUISE CENTER"],
    ["STEAM CLIMB", "蒸汽登高道", "#a4e5df", "CLIMB / SET YOUR LINE"],
    ["CLOCK CROWN", "鐘樓觀景台", "#c7b6ff", "LANDMARK REVEAL / HOLD YOUR LINE"],
    ["CONVEYOR CUT", "輸送帶分流", "#8df4bf", "NARROW SHORTCUT / WIDE MAIN ROAD"],
    ["PISTON YARD", "活塞折返道", "#ffa999", "DRIFT / WATCH THE ROBOT"],
    ["SPRING SPRINT", "發條衝線道", "#ffdf84", "TURBO HOME"],
  ]),
  volcano: districts([0,.19,.34,.5,.75,.88,1], [
    ["EMBER GATE", "熔光迎賓道", "#ffbc78", "JUMP RIGHT / CRUISE CENTER"],
    ["BASALT CLIMB", "玄岩登高道", "#e39291", "CLIMB / SET YOUR LINE"],
    ["CALDERA RIM", "火口環崖橋", "#ffdf9b", "LANDMARK REVEAL / HOLD YOUR LINE"],
    ["COOLING CAVE", "冷卻洞分流", "#9ce4dd", "NARROW SHORTCUT / WIDE MAIN ROAD"],
    ["ORE SWITCHBACK", "熔礦折返谷", "#ff9e68", "DRIFT / WATCH THE ROBOT"],
    ["AFTERGLOW RUN", "餘燼衝線道", "#f8b4dc", "TURBO HOME"],
  ]),
  harbor: districts([0, .14, .28, .42, .56, .74, .88, 1], [
    ["TIDELIGHT PLAZA", "潮光迎賓碼頭", "#ff9abb", "WATCH THE CARGO ROBOT"],
    ["CRANE CLIMB", "吊臂登高道", "#ffc06a", "CLIMB / SET YOUR LINE"],
    ["SKY DOCK", "雲端貨運橋", "#69eaff", "JUMP RIGHT / CRUISE CENTER"],
    ["PULSE TERMINAL", "霓虹脈衝轉運站", "#b397ff", "FOLLOW THE LIGHT STRIP"],
    ["SERVICE QUAY", "維修棧橋分流區", "#83f4c6", "RIGHT: NARROW QUAY / LEFT: MAIN"],
    ["HARBOR LAUNCH", "港灣飛躍大道", "#ffd477", "LAND / TURBO / RECOVER"],
    ["NIGHT MARKET", "港口夜市衝線區", "#ff97d8", "CHICANE THEN FINISH"],
  ]),
  canyon: districts([0, .17, .33, .49, .65, .82, 1], [
    ["SUNFAIR GATE", "落日市集入口", "#ffd477", "JUMP RIGHT / CRUISE CENTER"],
    ["MESA CLIMB", "赤岩登高道", "#f6a775", "CARVE THE UPHILL BEND"],
    ["ECHO CROWN", "回音巨岩高台", "#ffe5a0", "ARCH REVEAL / HOLD YOUR LINE"],
    ["MINE CUT", "礦洞下坡分流區", "#8ee1c2", "LEFT: NARROW MINE / RIGHT: MAIN"],
    ["OASIS SWITCHBACK", "綠洲折返谷", "#6ed7d3", "DRIFT / WATCH THE MINE CART"],
    ["SUNSET SPRINT", "落日飛躍大道", "#ff9db0", "LAND AND TURBO HOME"],
  ]),
  aurora: districts([0, .14, .28, .42, .56, .72, .86, 1], [
    ["SNOWLIGHT FAIR", "雪光迎賓廣場", "#ffd8a6", "JUMP RIGHT / CRUISE CENTER"],
    ["FROSTWOOD CLIMB", "冰林登高道", "#9cceff", "LONG DRIFT / SHORT CORRECTION"],
    ["FIRST SUMMIT", "第一雪峰觀景台", "#d0b4ff", "SUMMIT REVEAL THEN DESCEND"],
    ["MIRROR LAKE", "鏡湖回復直線", "#89e8e0", "WATCH THE SNOWKEEPER"],
    ["CRYSTAL CUT", "晶洞捷徑分流區", "#a6ffdd", "RIGHT: CRYSTAL CAVE / LEFT: HIGH ROAD"],
    ["AURORA RIDGE", "極光第二峰", "#e1c2ff", "LAND BEFORE THE DOWNHILL BEND"],
    ["LANTERN RETURN", "冰燈衝線大道", "#ffbddd", "FINAL DRIFT / FINISH"],
  ]),
};

export const PARK_BRANCHES = {
  ...TAIWAN_BRANCHES,
  tainan: { entry: .54, exit: .70, width: 5.8, handle: 14, side: 1, name: "老街內巷" },
  taichung: { entry: .54, exit: .70, width: 5.8, handle: 14, side: 1, name: "花園內街" },
  forest: { entry: .63, exit: .748, width: 5.8, handle: 8, side: 1, name: "樹根洞捷徑" },
  clockwork: { entry: .54, exit: .74, width: 5.8, handle: 20, side: 1, name: "輸送帶密道" },
  volcano: { entry: .54, exit: .74, width: 5.8, handle: 20, side: 1, name: "冷卻洞捷徑" },
  harbor: { entry: .605, exit: .735, width: 5.8, handle: 14, side: 1, name: "維修棧橋捷徑" },
  canyon: { entry: .54, exit: .635, width: 5.8, handle: 12, side: -1, name: "回音礦洞捷徑" },
  aurora: { entry: .56, exit: .705, width: 5.8, handle: 16, side: 1, name: "發光晶洞捷徑" },
} as const;
export const PARK_OBSTACLE_FRACTIONS: Readonly<Record<TrackId, number>> = { tainan: .82, taichung: .82, taipei: .285, jiufen: .405, kaohsiung: .285, alishan: .415, forest: .79, clockwork: .79, volcano: .79, meadow: .775, harbor: .105, canyon: .68, aurora: .43 };
export const PARK_BIG_JUMP_SPEED = 7.5;

export function createThemeParkBranches(id: Exclude<TrackId, "meadow">, route: readonly RaceRouteSample[],
  config: Readonly<{ entry: number; exit: number; width: number; handle: number; side: number; name: string }> = PARK_BRANCHES[id]): readonly TrackBranch[] {
  const from = route[Math.round(route.length * config.entry)], to = route[Math.round(route.length * config.exit)];
  const path = createOpenTrackSamples([[from.position,
    [from.position[0] + from.tangent[0] * config.handle, from.position[1] + from.tangent[1] * config.handle],
    [to.position[0] - to.tangent[0] * config.handle, to.position[1] - to.tangent[1] * config.handle], to.position]], from, to);
  const entrance = route.slice(Math.max(0, Math.round(route.length * config.entry) - 2), Math.round(route.length * config.entry) + 25);
  const exit = route.slice(Math.round(route.length * config.exit) - 25, Math.round(route.length * config.exit) + 3);
  const profile = path.map(sample => {
    if (isTaiwanTrack(id)) {
      // Tight mountain turns can share a deck beyond the entrance's short
      // window. Match every overlapping main deck, avoiding two solid roads
      // with a small height gap that could trap a kart between them.
      const surface = sampleTrackSurface(...sample.position,route,undefined,{height:sample.height});
      const t=Math.max(0,Math.min(1,(surface.distance-8.5)/8));
      const blend=t*t*(3-2*t);
      const bank=Math.atan(sample.normal[0]*surface.gradientX+sample.normal[1]*surface.gradientZ);
      return {...sample,height:surface.height+(sample.height-surface.height)*blend,bank:bank+(sample.bank-bank)*blend};
    }
    // Match the local main deck through each merge, then blend into the
    // independent profile. Remote bends must never determine branch height.
    const edge = Math.min(sample.progress, 1 - sample.progress);
    if (edge >= .3 && sample.progress < .5) return sample;
    const surface = sampleTrackSurface(...sample.position, sample.progress < .5 ? entrance : exit, undefined, { closed: false, height: sample.height });
    // The full road widths can overlap before the centreline merge. Match
    // the main deck throughout that overlap, not just at the final endpoint.
    const t = sample.progress >= .5 ? Math.max(0, Math.min(1, (surface.distance - 8.5) / 8)) : Math.min(1, edge / .3);
    let weight = t * t * (3 - 2 * t);
    if (sample.progress >= .5) {
      const blend = Math.min(1, (sample.progress - .5) / .2);
      weight = 1 - (1 - weight) * blend * blend * (3 - 2 * blend);
    }
    const bank = Math.atan(sample.normal[0] * surface.gradientX + sample.normal[1] * surface.gradientZ);
    return { ...sample, height: surface.height + (sample.height - surface.height) * weight,
      bank: bank + (sample.bank - bank) * weight };
  });
  const samples = profile.map(sample => ({ ...sample, width: shortcutWidth(sample, config.width) }));
  return [{ id: `${id}-cut`, name: config.name, width: config.width, samples,
    entryProgress: from.raceProgress, exitProgress: to.raceProgress,
    geometry: createTrackGeometry(samples, { closed: false, width: config.width,
      avoidRoads: [{ samples: route, width: 8.4 }], railOpenings: ([-1, 1] as const).flatMap(side =>
        [{ side, from: 0, to: .25 }, { side, from: .75, to: 1 }]) }) }];
}

export function themeParkRailOpenings(id: Exclude<TrackId, "meadow">, branches: readonly TrackBranch[], route: readonly RaceRouteSample[]): readonly RailOpening[] {
  return branches.flatMap(branch => [branch.entryProgress, branch.exitProgress].map((progress, i) => {
    const sample = route[Math.round(progress * route.length) % route.length];
    return { side: PARK_BRANCHES[id].side, from: sample.progress - (i ? .04 : .012), to: sample.progress + (i ? .012 : .04) };
  }));
}
