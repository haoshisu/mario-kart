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
    description: "登上霓虹高架，衝刺港灣長直線，穿過碼頭換線彎。", difficulty: "速度 · 碼頭長環線",
    colors: { asphalt: "#344361", curbRed: "#e855be", curbWhite: "#c4effb", grass: "#233a59", railRed: "#35d9e4", railWhite: "#eb89cf" },
    sky: "#202e60", sunlight: "#b8cbff", accent: "#53e8ef", curves: [start,
      [[14,-10.5],[35,-10.5],[58,-10.5],[58,8]],
      [[58,8],[58,18],[46,20],[46,30]],
      [[46,30],[46,40],[58,42],[58,52]],
      [[58,52],[58,65],[40,65],[24,65]],
      [[24,65],[-2,65],[-32,65],[-48,65]],
      [[-48,65],[-63,65],[-63,48],[-63,30]],
      [[-63,30],[-63,10],[-63,-10.5],[-43,-10.5]],
      [[-43,-10.5],[-38,-10.5],[-33,-10.5],[-28,-10.5]], end] },
  canyon: { elevation: [[0,0],[.1,0],[.31,10],[.49,8],[.69,1],[.8,3.5],[.94,0],[1,0]], id: "canyon", name: "落日砂岩", subtitle: "SUNSET CANYON",
    description: "沿巨岩攀上十米高架，以長下坡切入深谷髮夾彎。", difficulty: "漂移 · 深谷髮夾",
    colors: { asphalt: "#a66f58", curbRed: "#ec823f", curbWhite: "#fff0bf", grass: "#dfac74", railRed: "#ac4736", railWhite: "#f9d68c" },
    sky: "#f8b998", sunlight: "#ffce91", accent: "#ffbf6c", curves: [start,
      [[14,-10.5],[34,-10.5],[55,-10.5],[55,9]],
      [[55,9],[55,31],[47,48],[27,60]],
      [[27,60],[7,73],[-12,69],[-12,48]],
      [[-12,48],[-12,35],[-20,33],[-20,20]],
      [[-20,20],[-20,8],[-35,8],[-42,8]],
      [[-42,8],[-58,8],[-58,-10.5],[-40,-10.5]],
      [[-40,-10.5],[-36,-10.5],[-32,-10.5],[-28,-10.5]], end] },
  aurora: { elevation: [[0,0],[.1,0],[.28,7],[.44,3],[.61,9],[.79,4],[.94,0],[1,0]], id: "aurora", name: "極光冰谷", subtitle: "AURORA FJORD",
    description: "穿越冰林雙峰，在極光下沿蛇形冰道連續換向與飛躍。", difficulty: "技巧 · 蛇形雙峰",
    colors: { asphalt: "#719bb8", curbRed: "#8e8ce8", curbWhite: "#e6fcff", grass: "#c8e3ed", railRed: "#39adb9", railWhite: "#e4eeff" },
    sky: "#234662", sunlight: "#c3e6ff", accent: "#83ffcf", curves: [start,
      [[14,-10.5],[32,-10.5],[46,-10.5],[46,5]],
      [[46,5],[46,20],[15,17],[15,32]],
      [[15,32],[15,47],[46,44],[46,59]],
      [[46,59],[46,74],[18,76],[0,76]],
      [[0,76],[-20,76],[-44,75],[-44,57]],
      [[-44,57],[-44,42],[-15,44],[-15,29]],
      [[-15,29],[-15,14],[-44,17],[-44,2]],
      [[-44,2],[-44,-8],[-38,-10.5],[-28,-10.5]], end] },
};
