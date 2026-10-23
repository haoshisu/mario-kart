import type { TrackData } from "./trackData";
import { distanceToTrack, pointAtTrackOffset } from "./trackPath";
import { routeLength, sampleAtDistance } from "./trackPlacement";
import type { TaiwanTrackId } from "./taiwanTracks";

/** Landmarks clear all playable ribbons; portals deliberately span the road. */
export function taiwanLandmarkSpots(track: TrackData, id: TaiwanTrackId) {
  const fractions = id === "taipei" ? [.40] : id === "jiufen" ? [.18,.56] : id === "kaohsiung" ? [.4,.54] : [.30,.55];
  const radius = id === "taipei" ? 18 : id === "jiufen" ? 14 : id === "kaohsiung" ? 19 : 15;
  return fractions.map(fraction => {
    const sample = sampleAtDistance(track.race.RACE_ROUTE_SAMPLES, fraction * routeLength(track.race.RACE_ROUTE_SAMPLES));
    for (const offset of [radius+10,-radius-10,radius+22,-radius-22]) {
      const [x,z] = pointAtTrackOffset(sample, offset);
      if ([track.samples,...track.branches.map(branch=>branch.samples)].every(road =>
        distanceToTrack(x,z,road,{closed:road===track.samples}) > radius+5)) return { position: [x,Math.max(0,sample.height-4),z] as const, fraction };
    }
    throw new Error(`No landmark clearance for ${id} at ${fraction}`);
  });
}
