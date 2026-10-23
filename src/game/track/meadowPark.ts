import { shortcutWidth } from "./courseDesign";
import type { RaceRouteSample } from "../core/race/raceTrack";
import { createTrackGeometry, type RailOpening } from "./trackGeometry";
import { createOpenTrackSamples } from "./openTrackPath";
import type { TrackSample } from "./trackPath";
import { createSurfaceResult, sampleTrackSurface } from "./trackSurface";

export const MEADOW_PARK_SECTIONS = [
  { id: "welcome", name: "花谷迎賓廣場", from: 0, to: .16 },
  { id: "bridge", name: "風車天空橋", from: .16, to: .33 },
  { id: "garden", name: "花穹空中花園", from: .33, to: .50 },
  { id: "greenhouse", name: "玻璃溫室轉角", from: .50, to: .65 },
  { id: "valley", name: "溪谷瀑布漂流道", from: .65, to: .82 },
  { id: "festival", name: "嘉年華衝線大道", from: .82, to: 1 },
] as const;
export const MEADOW_PARK_LANDMARKS = {
  windmill: { position: [-8, 0, 112] as const, yaw: 0 },
  greenhouse: { position: [30, 0, 164] as const, yaw: -.25 },
  waterfall: { position: [-6, 0, 88] as const, yaw: .7 },
  valley: { position: [0, 0, 67.428] as const, yaw: -.6 },
  flowerWheel: { position: [-91, 0, 60] as const, yaw: -.4 },
} as const;
export const MEADOW_PARK_BIG_JUMP = { fraction: .205, launchSpeed: 7.5 } as const;
export const MEADOW_PARK_OBSTACLE = { fraction: .775, lateralCenter: -2.45, lateralAmplitude: 1, period: 4.8, radius: .8 } as const;

export type TrackBranch = Readonly<{
  id: string; name: string; width: number; movable?: boolean; staticSections?: readonly (readonly TrackSample[])[]; samples: readonly TrackSample[];
  geometry: ReturnType<typeof createTrackGeometry>; entryProgress: number; exitProgress: number;
}>;

export function createMeadowBranches(route: readonly RaceRouteSample[]): readonly TrackBranch[] {
  const from = route[Math.round(route.length * .515)], to = route[Math.round(route.length * .63)];
  const path = createOpenTrackSamples([[from.position,
    [from.position[0] + from.tangent[0] * 17, from.position[1] + from.tangent[1] * 17],
    [to.position[0] - to.tangent[0] * 17, to.position[1] - to.tangent[1] * 17], to.position]], from, to);
  // Leave the shared entrance at its own elevation before descending. The
  // independent continuous profile cannot jump between nearby main-road arms.
  const entrance = route.slice(Math.round(route.length * from.raceProgress), Math.round(route.length * .56));
  const surface = createSurfaceResult();
  const profile = path.map((sample, index) => {
    if (index === 0) return { ...sample, height: from.height, bank: from.bank };
    if (index === path.length - 1) return { ...sample, height: to.height, bank: to.bank };
    const blend = Math.max(0, Math.min(1, (sample.progress - .25) / .5));
    const weight = blend * blend * (3 - 2 * blend);
    sampleTrackSurface(...sample.position, entrance, surface, { closed: false });
    const entranceBank = Math.atan(sample.normal[0] * surface.gradientX + sample.normal[1] * surface.gradientZ);
    return { ...sample, height: surface.height + (sample.height - surface.height) * weight,
      bank: entranceBank + (sample.bank - entranceBank) * weight };
  });
  const samples = profile.map(sample => ({ ...sample, width: shortcutWidth(sample, 6) }));
  return [{ id: "greenhouse-cut", name: "溫室窄橋捷徑", width: 6, samples,
    geometry: createTrackGeometry(samples, { closed: false, width: 6, avoidRoads: [{ samples: route, width: 8.4 }],
      railOpenings: ([-1, 1] as const).flatMap(side => [{ side, from: 0, to: .22 }, { side, from: .78, to: 1 }]) }),
    entryProgress: from.raceProgress, exitProgress: to.raceProgress }];
}

/** Open only the side used by the branch; keep the opposite main-road rail. */
export function meadowRailOpenings(branches: readonly TrackBranch[], route: readonly RaceRouteSample[]): readonly RailOpening[] {
  return branches.flatMap(branch => [branch.entryProgress, branch.exitProgress].map((progress, i) => {
    const sample = route[Math.round(progress * route.length) % route.length];
    return { side: -1 as const, from: sample.progress - (i ? .04 : .012), to: sample.progress + (i ? .012 : .04) };
  }));
}
