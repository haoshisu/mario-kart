import type { TrackId } from "../track/trackCatalog";

export const TAIWAN_SCENERY_LOD = { standardDistance: 105, lowDistance: 60, overviewHeight: 100 } as const;

/** Larger expansion loops need enough sight distance to navigate by landmarks. */
export function sceneFogDistances(id: TrackId, overview = false): readonly [number, number] {
  const expanded = ["taipei", "jiufen", "kaohsiung", "alishan", "tainan", "taichung"].includes(id) || id === "forest" || id === "clockwork" || id === "volcano";
  if (overview) return expanded ? [500, 950] : [260, 650];
  return expanded ? [100, 240] : [70, 165];
}

export function sceneCameraFar(id: TrackId) {
  return ["taipei", "jiufen", "kaohsiung", "alishan", "tainan", "taichung"].includes(id) ? 2400 : 240;
}

export function hasCityWorld(id: TrackId) { return id === "alishan" || id === "tainan" || id === "taichung" || id === "taipei" || id === "jiufen" || id === "kaohsiung"; }

export function sceneryDetailDistance(id: TrackId, quality: "standard" | "low") {
  return quality === "standard" ? TAIWAN_SCENERY_LOD.standardDistance : id === "jiufen" ? 42 : id === "taichung" ? 40 : id === "tainan" ? 48 : TAIWAN_SCENERY_LOD.lowDistance;
}
