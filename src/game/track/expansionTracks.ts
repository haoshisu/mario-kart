import type { TrackDefinition } from "./trackCatalog";
import type { TrackCurve, TrackPoint } from "./trackLayout";

function loop(points: readonly TrackPoint[]): readonly TrackCurve[] {
  const tangents = points.map((point, i): TrackPoint => {
    if (i < 3 || i >= points.length - 2) return [1, 0];
    const before = points[i - 1], after = points[(i + 1) % points.length];
    const dx = after[0] - before[0], dz = after[1] - before[1], length = Math.hypot(dx, dz);
    return [dx / length, dz / length];
  });
  return points.map((point, i): TrackCurve => {
    const next = points[(i + 1) % points.length], tangent = tangents[i], nextTangent = tangents[(i + 1) % points.length];
    const handle = Math.hypot(next[0] - point[0], next[1] - point[1]) * .34;
    return [point, [point[0] + tangent[0] * handle, point[1] + tangent[1] * handle],
      [next[0] - nextTangent[0] * handle, next[1] - nextTangent[1] * handle], next];
  });
}
const grid: readonly TrackPoint[] = [[-14,-10.5],[14,-10.5],[150,-10.5]];
const finish: readonly TrackPoint[] = [[-55,-10.5],[-23.1,-10.5]];
export const EXPANSION_TRACKS: Readonly<Record<"forest" | "clockwork" | "volcano", TrackDefinition>> = {
  forest: { id: "forest", name: "森冠探險", subtitle: "CANOPY EXPEDITION", description: "飛躍螢光溪流，攀上樹冠高橋，穿越樹根捷徑與巡遊採果車。", difficulty: "樂園 · 樹冠高橋與樹根洞",
    colors: { asphalt: "#537f66", curbRed: "#ffc16a", curbWhite: "#f5f0ba", grass: "#235745", railRed: "#ba8257", railWhite: "#c5e9a3" },
    sky: "#91cebb", sunlight: "#fff1b8", accent: "#b8f078",
    curves: loop([...grid,[195,30],[135,110],[45,150],[-40,135],[-95,100],[-65,62],[-100,24],...finish]),
    elevation: [[0,0],[.19,0],[.3,14],[.43,14],[.52,3],[.75,3],[.83,7],[.92,0],[1,0]] },
  clockwork: { id: "clockwork", name: "發條工坊", subtitle: "CLOCKWORK CARNIVAL", description: "飛躍齒輪廣場，攀登工坊高架，選走輸送帶密道，避開搬運機器人。", difficulty: "樂園 · 機械高架與工坊密道",
    colors: { asphalt: "#626787", curbRed: "#ecab52", curbWhite: "#fff0cf", grass: "#424757", railRed: "#c18342", railWhite: "#8ce6df" },
    sky: "#465774", sunlight: "#ffe0a6", accent: "#79e9e0",
    curves: loop([...grid,[206,25],[130,80],[160,135],[75,173],[-20,160],[-65,110],[-42,66],[-92,24],...finish]),
    elevation: [[0,0],[.19,0],[.3,12],[.42,12],[.52,2],[.75,2],[.82,9],[.94,0],[1,0]] },
  volcano: { id: "volcano", name: "熔光火山", subtitle: "EMBER CALDERA", description: "飛越熔光裂谷，登上火山環崖，穿越冷卻洞捷徑，閃過熔礦巡遊車。", difficulty: "樂園 · 火山環崖與熔洞",
    colors: { asphalt: "#615264", curbRed: "#ff8a4f", curbWhite: "#ffdfb8", grass: "#3b343d", railRed: "#bf5144", railWhite: "#ffb97b" },
    sky: "#422e51", sunlight: "#ffc598", accent: "#ffac60",
    curves: loop([...grid,[215,28],[180,105],[95,145],[20,131],[-42,175],[-115,115],[-105,55],[-65,40],...finish]),
    elevation: [[0,0],[.18,0],[.29,18],[.42,18],[.52,4],[.75,4],[.83,12],[.94,0],[1,0]] },
};
