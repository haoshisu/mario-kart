import { TRACK_CONFIG } from "./trackConfig";
import type { TrackSample } from "./trackPath";
import { createSurfaceResult, sampleTrackSurface } from "./trackSurface";

type DrivingRoads = { samples: readonly TrackSample[]; branches: readonly { samples: readonly TrackSample[]; width: number; movable?: boolean; staticSections?: readonly (readonly TrackSample[])[] }[] };
const branchSurface = createSurfaceResult();
/** Branches are open roads. Height separates overpasses without connecting their ends. */
export function sampleDrivingSurface(x: number, z: number, roads: DrivingRoads,
  out = createSurfaceResult(), height?: number, bridgeLocked = true) {
  sampleTrackSurface(x, z, roads.samples, out, { height });
  out.width ??= TRACK_CONFIG.roadWidth;
  out.routeIndex = 0;
  let best = out.distance ** 2 + (height === undefined ? 0 : (out.height - height) ** 2);
  for (let index = 0; index < roads.branches.length; index++) {
    const branch = roads.branches[index];
    const sections = branch.movable && !bridgeLocked
      ? branch.staticSections ?? [] : [branch.samples];
    for (const samples of sections) {
    sampleTrackSurface(x, z, samples, branchSurface, { height, closed: false, width: branch.width });
    const score = branchSurface.distance ** 2 + (height === undefined ? 0 : (branchSurface.height - height) ** 2);
    if (score >= best) continue;
    best = score;
    Object.assign(out, branchSurface);

    out.routeIndex = index + 1;
    }
  }
  return out;
}
