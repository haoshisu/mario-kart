import type { TrackDefinition, TrackId } from "./trackCatalog";
import { circuit } from "./taiwanTracks";

export type CityTrackId = "tainan" | "taichung";
export function isNewCity(id: TrackId): id is CityTrackId { return id === "tainan" || id === "taichung"; }
/** Fictional routes inspired by city character, not reproductions of real streets. */
export const CITY_TRACKS: Readonly<Record<CityTrackId, TrackDefinition>> = {
  tainan: { id: "tainan", name: "台南・府城暖巷", subtitle: "TAINAN CANAL FESTIVAL",
    description: "石磚老街考驗加速時機：走平順外線維持速度，或留下加速道具穿越內巷捷徑，再飛越夕照堤岸。", difficulty: "古城 · 石磚減速與加速選線",
    sky: "#efc6a6", sunlight: "#ffe7bd", accent: "#efaa66",
    colors: { asphalt: "#a18270", curbRed: "#b39473", curbWhite: "#d1b390", grass: "#8d9d70", railRed: "#ac7856", railWhite: "#bd8d65" },
    curves: circuit([[-14,-10.5],[14,-10.5],[95,-10.5],[150,25],[150,80],[110,115],[70,80],[22,115],[30,170],[115,200],[150,250],[110,295],[10,295],[-85,265],[-150,185],[-165,115],[-140,45],[-100,10],[-55,-10.5],[-23.1,-10.5]]),
    elevation: [[0,0],[.15,0],[.27,8],[.39,8],[.47,0],[.55,0],[.65,12],[.77,12],[.9,0],[1,0]] },
  taichung: { id: "taichung", name: "台中・綠園光廊", subtitle: "TAICHUNG GARDEN LOOP",
    description: "爬上天際線高架後飛躍綠園，花園內街與綠丘落葉彎考驗提早收線；右側乾淨路面提供穩定選擇。", difficulty: "都會 · 落葉側滑與出彎控線",
    sky: "#a9d9e4", sunlight: "#fff0cc", accent: "#8fdbb0",
    colors: { asphalt: "#6b8291", curbRed: "#e9ac6b", curbWhite: "#f2f3d2", grass: "#73a67e", railRed: "#5c9b8d", railWhite: "#e3e7c7" },
    curves: circuit([[-14,-10.5],[14,-10.5],[115,-10.5],[195,20],[205,80],[150,115],[90,150],[15,150],[-55,115],[-40,65],[-95,30],[-130,-30],[-125,-90],[-65,-115],[5,-115],[30,-75],[-25,-50],[-85,-42],[-55,-10.5],[-23.1,-10.5]]),
    elevation: [[0,0],[.18,0],[.31,16],[.44,16],[.55,4],[.7,4],[.8,10],[.94,0],[1,0]] },
};
