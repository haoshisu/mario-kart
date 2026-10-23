import type { ArchitecturePlacement } from "./taiwanArchitecture";

export type CityModule = "street" | "tea" | "harbor";
export type CityPlacement = Omit<ArchitecturePlacement, "module"> & { module: CityModule };
export const CITY_DETAIL_DISTANCE = { standard: 78, low: 28 } as const;
export const CITY_MODEL_URL = { standard: "/models/taiwan-city-v1.glb", low: "/models/taiwan-city-low-v1.glb" } as const;

/** Dressing stays in the already-cleared building envelope. Portal warehouses and
 * stacked landmark tea houses must remain unadorned to preserve their openings.
 */
export function cityDetailPlacements(buildings: readonly ArchitecturePlacement[]): CityPlacement[] {
  return buildings.flatMap(building => {
    if (building.portal || building.radius >= 14) return [];
    const module = building.module === "arcade" || building.module === "stucco" ? "street"
      : building.module === "tea" ? "tea" : building.module === "warehouse" ? "harbor" : null;
    return module ? [{ ...building, module }] : [];
  });
}
