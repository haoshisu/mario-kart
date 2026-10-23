import type { ParkDistrict } from "./themeParks";
import type { TaiwanTrackId } from "./taiwanTracks";

function sections(names: readonly string[], colors: readonly string[]): readonly ParkDistrict[] {
  const edges = [0,.12,.25,.375,.5,.625,.75,.875,1];
  return names.map((name, i) => ({ from: edges[i], to: edges[i + 1], title: name, name, color: colors[i % colors.length], cue: "" }));
}
export const TAIWAN_DISTRICTS: Readonly<Record<TaiwanTrackId, readonly ParkDistrict[]>> = {
  taipei: sections(["城門廣場","騎樓折角街","捷運換線平台","塔基長漂移彎","空中高速大道","屋頂大跳","夜市蛇行街","河岸回程"], ["#e69772","#f1c780","#6ddacb","#9bbbea"]),
  jiufen: sections(["燈籠廣場","茶樓窄巷","選煉廠階地","礦坑回復道","山脊高速彎","山城跨谷大跳","陰陽海防波堤","屋下回程隧道"], ["#f6b564","#dc7364","#b6c5a4","#83c6ca"]),
  kaohsiung: sections(["倉庫起跑大道","穿庫技術區","貨櫃換線場","跨港高橋","海洋基座高速彎","吊臂跨港大跳","潮汐低棧道","水岸衝線段"], ["#edb15f","#df8963","#7bd7d3","#bcdfd0"]),
  alishan: sections(["木站平台","茶園梯田髮夾","巨木根系彎","森林鐵路交會","雲霧螺旋爬坡","觀日高速山脊","雲海跨谷大跳","林間下坡回站"], ["#dfbb7d","#90bd78","#65ac91","#ffe0a0"]),
};
// Branch endpoints stay strictly within one legal checkpoint interval.
export const TAIWAN_BRANCHES = {
  taipei: { entry: .135, exit: .24, width: 5.8, handle: 12, side: 1, name: "騎樓內街捷徑" },
  jiufen: { entry: .27, exit: .365, width: 5.8, handle: 12, side: -1, name: "選煉廠維修礦坑" },
  kaohsiung: { entry: .135, exit: .24, width: 5.8, handle: 12, side: 1, name: "倉庫裝卸通道" },
  alishan: { entry: .27, exit: .365, width: 5.8, handle: 12, side: -1, name: "巨木根系窄道" },
} as const;
