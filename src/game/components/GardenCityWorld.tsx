import { useEffect, useMemo } from "react";
import { useTrack } from "../track/TrackContext";
import type { CityTrackId } from "../track/cityTracks";
import { cityWorldLayout } from "../track/gardenCities";
import { gardenCityGeometry } from "../rendering/gardenCityGeometry";
import { useRenderQuality } from "../rendering/RenderSettings";
import { TaiwanArchitecture } from "./TaiwanArchitecture";
import { TaiwanDistantBuildings } from "./TaiwanDistantBuildings";
import { TaiwanCityDetails } from "./TaiwanCityDetails";
import { TaiwanSky } from "./TaiwanSky";
import { ParkDistrictDetails } from "./ParkDistrictDetails";
import { TracksideResidents } from "./TracksideResidents";

export function GardenCityWorld({ id }: { id: CityTrackId }) {
  const track = useTrack(), quality = useRenderQuality();
  const layout = useMemo(() => cityWorldLayout(track, id), [track, id]);
  const geometry = useMemo(() => gardenCityGeometry(track, id, quality === "low"), [track, id, quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name={`${id}-city-world`}>
    <TaiwanSky /><ParkDistrictDetails /><mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={.85} fog={false} /></mesh>
    <TaiwanArchitecture placements={layout.streets} /><TaiwanDistantBuildings placements={layout.streets} />
    <TaiwanCityDetails buildings={layout.streets} /><TracksideResidents />
  </group>;
}
