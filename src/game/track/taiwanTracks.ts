import type { TrackDefinition, TrackId } from "./trackCatalog";
import type { TrackCurve, TrackPoint } from "./trackLayout";

export const TAIWAN_TRACK_IDS = ["taipei", "jiufen", "kaohsiung", "alishan"] as const;
export type TaiwanTrackId = typeof TAIWAN_TRACK_IDS[number];
export function isTaiwanTrack(id: TrackId): id is TaiwanTrackId {
  return TAIWAN_TRACK_IDS.some(value => value === id);
}

// Authored fictional loops; no coordinates or road geometry come from maps.
export function circuit(points: readonly TrackPoint[]): readonly TrackCurve[] {
  const directions = points.map((point, index): TrackPoint => {
    if (index < 2 || index >= points.length - 2) return [1, 0];
    const before = points[index - 1], after = points[(index + 1) % points.length];
    const dx = after[0] - before[0], dz = after[1] - before[1], length = Math.hypot(dx, dz);
    return [dx / length, dz / length];
  });
  return points.map((point, index): TrackCurve => {
    const next = points[(index + 1) % points.length], a = directions[index], b = directions[(index + 1) % points.length];
    const handle = Math.hypot(next[0] - point[0], next[1] - point[1]) * .32;
    return [point, [point[0] + a[0] * handle, point[1] + a[1] * handle],
      [next[0] - b[0] * handle, next[1] - b[1] * handle], next];
  });
}
const grid: readonly TrackPoint[] = [[-14,-10.5],[14,-10.5]];
const finish: readonly TrackPoint[] = [[-55,-10.5],[-23.1,-10.5]];
export const TAIWAN_TRACKS: Readonly<Record<TaiwanTrackId, TrackDefinition>> = {
  taipei: { id: "taipei", name: "台北・霓虹疊城", subtitle: "TAIPEI SKYLINE", difficulty: "都市 · 騎樓折角與屋頂大跳",
    description: "穿越紅磚城門與騎樓，繞上分節高塔，在捷運與夜市之間飛躍屋頂。",
    sky: "#263858", sunlight: "#ffe3c4", accent: "#6ae6da",
    colors: { asphalt: "#555861", curbRed: "#d96556", curbWhite: "#ffe6bc", grass: "#253c47", railRed: "#5dd6c9", railWhite: "#f8bb7c" },
    curves: circuit([...grid,[70,-10.5],[104,15],[82,42],[116,66],[154,66],[195,90],[208,130],[184,166],[146,176],
      [94,176],[38,176],[-20,176],[-58,150],[-64,112],[-94,87],[-70,59],[-99,33],[-150,0],[-150,-40],[-120,-64],[-102,-40],[-95,-10.5],...finish]),
    elevation: [[0,0],[.15,0],[.29,12],[.43,30],[.57,30],[.73,12],[.9,12],[.97,0],[1,0]] },
  jiufen: { id: "jiufen", name: "九份・金霧飛城", subtitle: "JIUFEN GOLDEN MIST", difficulty: "山城 · 階地髮夾與礦坑捷徑",
    description: "攀登燈籠茶樓與選煉廠階地，穿過礦坑，飛向藍黃交界的海灣。",
    sky: "#657e8b", sunlight: "#ffd398", accent: "#ffb973",
    colors: { asphalt: "#7b7468", curbRed: "#bc5149", curbWhite: "#ffe3b4", grass: "#355b53", railRed: "#d89b61", railWhite: "#f3ce9b" },
    curves: circuit([...grid,[105,-10.5],[172,15],[195,65],[160,105],[112,105],[112,62],[68,62],[68,115],[32,155],[-35,172],[-115,172],[-180,172],[-205,130],[-205,35],[-205,-35],[-120,-65],[-95,-45],[-95,-10.5],...finish]),
    elevation: [[0,0],[.12,0],[.25,18],[.375,18],[.49,42],[.66,42],[.79,8],[.9,8],[.97,0],[1,0]] },
  kaohsiung: { id: "kaohsiung", name: "高雄・轉港狂潮", subtitle: "KAOHSIUNG PORT RHYTHM", difficulty: "港灣 · 吊掛貨櫃與潮汐棧道",
    description: "穿過藝術倉庫，讀取吊具節奏，攀上帆形跨港橋，再飛躍貨輪船渠。",
    sky: "#f3be98", sunlight: "#ffe0b8", accent: "#66ddcf",
    colors: { asphalt: "#647a86", curbRed: "#e78550", curbWhite: "#fff0cc", grass: "#2e7581", railRed: "#dfad62", railWhite: "#c1f0df" },
    curves: circuit([...grid,[95,-10.5],[160,20],[160,70],[210,105],[240,155],[200,200],[120,210],[35,210],[-65,210],[-125,165],[-125,100],[-90,70],[-135,35],[-135,-25],[-90,-55],...finish]),
    elevation: [[0,0],[.25,0],[.375,28],[.68,28],[.79,4],[.9,4],[.97,0],[1,0]] },
  alishan: { id: "alishan", name: "阿里山・雲海追光", subtitle: "ALISHAN CLOUD EXPRESS", difficulty: "森林 · 茶園雙峰與雲海大跳",
    description: "沿茶畦漂移，穿越巨木與森林鐵路，衝出雲層飛向金色日出。",
    sky: "#b8d0ca", sunlight: "#fff0c2", accent: "#b9df83",
    colors: { asphalt: "#78856a", curbRed: "#b8764c", curbWhite: "#f6e8bd", grass: "#315e48", railRed: "#9a724c", railWhite: "#cee2b7" },
    curves: circuit([...grid,[100,-10.5],[160,22],[180,68],[132,105],[90,70],[45,106],[55,165],[135,205],[120,255],[30,255],[-70,255],[-145,230],[-170,180],[-170,110],[-155,40],[-105,5],...finish]),
    elevation: [[0,0],[.13,0],[.25,20],[.39,8],[.46,8],[.61,44],[.76,44],[.87,12],[.97,0],[1,0]] },
};
