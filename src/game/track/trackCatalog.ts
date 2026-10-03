import { VALLEY_ELEVATION, type ElevationKey } from "./trackSurface";
import { TRACK_CURVES, type TrackCurve } from "./trackLayout";
import { TRACK_COLORS } from "./trackConfig";

export const TRACK_IDS = ["meadow", "harbor", "canyon", "aurora"] as const;
export type TrackId = typeof TRACK_IDS[number];
export function isTrackId(value: unknown): value is TrackId {
  return TRACK_IDS.some((id) => id === value);
}

type Palette = { [Key in keyof typeof TRACK_COLORS]: string };
export type TrackDefinition = Readonly<{
  id: TrackId; name: string; subtitle: string; description: string; difficulty: string;
  colors: Palette; sky: string; sunlight: string; accent: string;
  curves: readonly TrackCurve[];
  elevation: readonly ElevationKey[];
}>;

// Every circuit shares a straight starting grid, but has its own authored loop.
const start: TrackCurve = [[-14, -10.5], [-4, -10.5], [4, -10.5], [14, -10.5]];
const end: TrackCurve = [[-28, -10.5], [-23, -10.5], [-19, -10.5], [-14, -10.5]];
export const TRACK_CATALOG: Readonly<Record<TrackId, TrackDefinition>> = {
  meadow: { elevation: VALLEY_ELEVATION, id: "meadow", name: "風車花谷", subtitle: "WINDMILL VALLEY",
    description: "爬上花田丘陵，在風車連續彎下坡漂移。", difficulty: "均衡 · 連續彎",
    colors: TRACK_COLORS, sky: "#83d3f4", sunlight: "#fff1d2", accent: "#b9ee65", curves: TRACK_CURVES },
  harbor: { elevation: [[0,0],[.11,0],[.29,7.5],[.46,7.5],[.67,0],[.8,2],[.94,0],[1,0]], id: "harbor", name: "霓虹港都", subtitle: "NEON HARBOR",
    description: "登上霓虹高架，越過貨櫃碼頭，再俯衝港灣雙彎。", difficulty: "速度 · 長直線",
    colors: { asphalt: "#344361", curbRed: "#e855be", curbWhite: "#c4effb", grass: "#233a59", railRed: "#35d9e4", railWhite: "#eb89cf" },
    sky: "#202e60", sunlight: "#b8cbff", accent: "#53e8ef", curves: [start,
      [[14,-10.5],[33,-10.5],[49,-10.5],[49,5]],
      [[49,5],[49,20],[49,35],[32,35]],
      [[32,35],[18,35],[22,14],[7,14]],
      [[7,14],[-8,14],[-8,35],[-25,35]],
      [[-25,35],[-42,35],[-49,27],[-49,12]],
      [[-49,12],[-49,-3],[-43,-10.5],[-28,-10.5]], end] },
  canyon: { elevation: [[0,0],[.1,0],[.31,10],[.49,8],[.69,1],[.8,3.5],[.94,0],[1,0]], id: "canyon", name: "落日砂岩", subtitle: "SUNSET CANYON",
    description: "沿巨岩攀上十米高架，以長下坡串起砂岩大彎。", difficulty: "漂移 · 大弧彎",
    colors: { asphalt: "#a66f58", curbRed: "#ec823f", curbWhite: "#fff0bf", grass: "#dfac74", railRed: "#ac4736", railWhite: "#f9d68c" },
    sky: "#f8b998", sunlight: "#ffce91", accent: "#ffbf6c", curves: [start,
      [[14,-10.5],[34,-10.5],[48,-4],[48,12]],
      [[48,12],[48,27],[38,41],[22,41]],
      [[22,41],[6,41],[8,23],[-8,23]],
      [[-8,23],[-23,23],[-22,43],[-38,36]],
      [[-38,36],[-52,30],[-53,17],[-50,5]],
      [[-50,5],[-47,-7],[-40,-10.5],[-28,-10.5]], end] },
  aurora: { elevation: [[0,0],[.1,0],[.28,7],[.44,3],[.61,9],[.79,4],[.94,0],[1,0]], id: "aurora", name: "極光冰谷", subtitle: "AURORA FJORD",
    description: "穿越冰林雙峰，在極光下連續爬升、下坡與換向。", difficulty: "技巧 · 節奏換向",
    colors: { asphalt: "#719bb8", curbRed: "#8e8ce8", curbWhite: "#e6fcff", grass: "#c8e3ed", railRed: "#39adb9", railWhite: "#e4eeff" },
    sky: "#234662", sunlight: "#c3e6ff", accent: "#83ffcf", curves: [start,
      [[14,-10.5],[29,-10.5],[39,-8],[39,5]],
      [[39,5],[39,18],[53,19],[49,32]],
      [[49,32],[45,46],[26,47],[16,36]],
      [[16,36],[6,25],[6,15],[-8,15]],
      [[-8,15],[-22,15],[-22,39],[-38,34]],
      [[-38,34],[-53,29],[-52,14],[-49,5]],
      [[-49,5],[-46,-6],[-41,-10.5],[-28,-10.5]], end] },
};
