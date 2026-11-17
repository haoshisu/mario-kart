import { VALLEY_ELEVATION, type ElevationKey } from "./trackSurface";
import { TRACK_CURVES, type TrackCurve } from "./trackLayout";
import { EXPANSION_TRACKS } from "./expansionTracks";
import { TAIWAN_TRACKS } from "./taiwanTracks";
import { CITY_TRACKS } from "./cityTracks";
import { TRACK_COLORS } from "./trackConfig";

export const TRACK_IDS = ["meadow", "harbor", "canyon", "aurora", "forest", "clockwork", "volcano", "taipei", "jiufen", "kaohsiung", "alishan", "tainan", "taichung"] as const;
export type TrackId = typeof TRACK_IDS[number];
export function isTrackId(value: unknown): value is TrackId {
  return TRACK_IDS.some((id) => id === value);
}

/** Courses offered to players: the Taiwan city series. Other ids remain as internal fixtures only. */
export const PLAYABLE_TRACK_IDS = ["taipei", "jiufen", "kaohsiung", "tainan", "taichung"] as const satisfies readonly TrackId[];
export type PlayableTrackId = typeof PLAYABLE_TRACK_IDS[number];
export const DEFAULT_TRACK_ID: PlayableTrackId = "taipei";
export function isPlayableTrackId(value: unknown): value is PlayableTrackId {
  return PLAYABLE_TRACK_IDS.some((id) => id === value);
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
const end: TrackCurve = [[-23.1, -10.5], [-19.85, -10.5], [-17.25, -10.5], [-14, -10.5]];
export const TRACK_CATALOG: Readonly<Record<TrackId, TrackDefinition>> = {
  ...CITY_TRACKS,
  ...EXPANSION_TRACKS,
  ...TAIWAN_TRACKS,
  meadow: { elevation: VALLEY_ELEVATION, id: "meadow", name: "風車花谷", subtitle: "WINDMILL VALLEY",
    description: "穿越六區花谷樂園，飛躍天空橋、選走溫室窄橋，再下穿瀑布溪谷衝線。", difficulty: "樂園 · 高低交叉與捷徑",
    colors: TRACK_COLORS, sky: "#83d3f4", sunlight: "#fff1d2", accent: "#b9ee65", curves: TRACK_CURVES },
  harbor: { elevation: [[0,0],[.12,0],[.27,7.5],[.46,7.5],[.64,2],[.72,0],[1,0]], id: "harbor", name: "霓虹港都", subtitle: "NEON HARBOR",
    description: "穿越七區霓虹港灣，飛躍貨運天空橋，選走維修棧橋，閃過物流機器人。", difficulty: "樂園 · 港灣高架與窄橋",
    colors: { asphalt: "#454782", curbRed: "#e855be", curbWhite: "#c4effb", grass: "#233a59", railRed: "#35d9e4", railWhite: "#eb89cf" },
    sky: "#202e60", sunlight: "#b8cbff", accent: "#53e8ef", curves: [start,
      [[14,-10.5],[28.3,-10.5],[46.5,-10.5],[55.6,1.525]],
      [[55.6,1.525],[64.7,13.225],[50.4,22.325],[59.5,34.025]],
      [[59.5,34.025],[69.9,48.325],[88.1,48.325],[88.1,66.525]],
      [[88.1,66.525],[88.1,86.025],[72.5,104.225],[51.7,104.225]],
      [[51.7,104.225],[32.2,104.225],[12,104.225],[-16.6,104.225]],
      [[-16.6,104.225],[-34.8,104.225],[-69.9,84.725],[-69.9,66.525]],
      [[-69.9,66.525],[-69.9,47.025],[-69.9,22.325],[-69.9,2.825]],
      [[-69.9,2.825],[-69.9,-12.775],[-77.7,-16.675],[-77.7,-32.275]],
      [[-77.7,-32.275],[-77.7,-58.875],[-64.7,-70.375],[-50.4,-70.375]],
      [[-50.4,-70.375],[-34.15,-70.375],[-14,-70.375],[10,-70.375]],
      [[10,-70.375],[24.4,-70.375],[24.4,-42.975],[10,-42.975]],
      [[10,-42.975],[-10,-42.975],[-41.3,-42.975],[-41.3,-26.575]],
      [[-41.3,-26.575],[-41.3,-15.875],[-33.8,-10.5],[-23.1,-10.5]], end] },
  canyon: { elevation: [[0,0],[.23,0],[.34,10],[.44,10],[.61,2],[.73,1],[.79,3.5],[.91,3.5],[.97,0],[1,0]], id: "canyon", name: "落日砂岩", subtitle: "SUNSET CANYON",
    description: "穿越六區落日樂園，攀上巨岩高台，選走回音礦洞，沿綠洲髮夾漂移衝線。", difficulty: "樂園 · 岩拱高台與礦洞",
    colors: { asphalt: "#c68e67", curbRed: "#ec823f", curbWhite: "#fff0bf", grass: "#dfac74", railRed: "#ac4736", railWhite: "#f9d68c" },
    sky: "#f8b998", sunlight: "#ffce91", accent: "#ffbf6c", curves: [start,
      [[14,-10.5],[32.2,-10.5],[56.9,-10.5],[56.9,8.025]],
      [[56.9,8.025],[56.9,22.325],[56.9,45.725],[56.9,60.025]],
      [[56.9,60.025],[56.9,84.725],[38.7,108.125],[17.9,114.625]],
      [[17.9,114.625],[-10,121.125],[-41.3,118.525],[-41.3,97.725]],
      [[-41.3,97.725],[-41.3,80.825],[-24.4,76.925],[-24.4,60.025]],
      [[-24.4,60.025],[-24.4,44.425],[-24.4,24.925],[-24.4,19.325]],
      [[-24.4,19.325],[-24.4,3.725],[-42.6,3.725],[-42.6,19.325]],
      [[-42.6,19.325],[-42.6,23.625],[-42.6,44.425],[-42.6,58.725]],
      [[-42.6,58.725],[-42.6,75.625],[-76.4,75.625],[-76.4,58.725]],
      [[-76.4,58.725],[-76.4,44.825],[-76.4,28.125],[-76.4,14.225]],
      [[-76.4,14.225],[-76.4,0.565],[-65.36,-10.5],[-51.675,-10.5]],
      [[-51.675,-10.5],[-41.7,-10.5],[-31.9,-10.5],[-23.1,-10.5]], end] },
  aurora: { elevation: [[0,0],[.21,0],[.30,7],[.36,7],[.47,3],[.59,3],[.68,9],[.78,9],[.90,4],[.97,0],[1,0]], id: "aurora", name: "極光冰谷", subtitle: "AURORA FJORD",
    description: "穿越七區極光樂園，征服冰林雙峰，選走發光晶洞，閃過巡遊雪地車。", difficulty: "樂園 · 雙峰冰原與晶洞",
    colors: { asphalt: "#789ecf", curbRed: "#8e8ce8", curbWhite: "#e6fcff", grass: "#c8e3ed", railRed: "#39adb9", railWhite: "#e4eeff" },
    sky: "#234662", sunlight: "#c3e6ff", accent: "#83ffcf", curves: [start,
      [[14,-10.5],[27,-10.5],[46.5,-10.5],[46.5,5.425]],
      [[46.5,5.425],[46.5,19.725],[46.5,40.525],[46.5,54.825]],
      [[46.5,54.825],[46.5,70.425],[20.5,70.425],[20.5,86.025]],
      [[20.5,86.025],[20.5,102.925],[32.2,106.825],[49.1,106.825]],
      [[49.1,106.825],[66,106.825],[77.7,122.425],[62.1,136.725]],
      [[62.1,136.725],[46.5,151.025],[32.2,153.625],[15.3,153.625]],
      [[15.3,153.625],[-12,153.625],[-32.2,153.625],[-50.4,153.625]],
      [[-50.4,153.625],[-69.9,153.625],[-90.7,138.025],[-90.7,117.225]],
      [[-90.7,117.225],[-90.7,100.325],[-90.7,80.825],[-90.7,63.925]],
      [[-90.7,63.925],[-90.7,47.025],[-58.2,49.625],[-58.2,32.725]],
      [[-58.2,32.725],[-58.2,19.725],[-72.5,17.125],[-72.5,4.125]],
      [[-72.5,4.125],[-72.5,-10.5],[-51.7,-10.5],[-37.4,-10.5]],
      [[-37.4,-10.5],[-32.85,-10.5],[-27.65,-10.5],[-23.1,-10.5]], end] },
};
