import type { RaceRouteSample } from "../core/race/raceTrack";
import type { TrackId } from "./trackCatalog";
import { roadOrientation, sampleTrackSurface } from "./trackSurface";
import { TRACK_CONFIG } from "./trackConfig";
import { distanceToTrack, type TrackSample } from "./trackPath";

const SECTION = {
  tainan: { name: "府城紅磚廊", fraction: .18, frames: 7, spacing: 4 },
  taichung: { name: "綠園光廊", fraction: .36, frames: 7, spacing: 4 },
  taipei: { name: "紅磚騎樓", fraction: .18, frames: 7, spacing: 4 },
  jiufen: { name: "礦坑支架", fraction: .42, frames: 7, spacing: 4 },
  kaohsiung: { name: "倉庫穿堂", fraction: .18, frames: 7, spacing: 4 },
  alishan: { name: "森林木站", fraction: .42, frames: 7, spacing: 4 },
  forest: { name: "藤蔓樹冠拱廊", fraction: .36, frames: 7, spacing: 4 },
  clockwork: { name: "脈衝齒輪長廊", fraction: .36, frames: 8, spacing: 4 },
  volcano: { name: "熔光玄岩拱廊", fraction: .36, frames: 7, spacing: 4 },
  meadow: { name: "花穹風車大道", fraction: .365, frames: 7, spacing: 4 },
  harbor: { name: "霓虹脈衝隧道", fraction: .565, frames: 9, spacing: 4 },
  canyon: { name: "巨岩回音拱廊", fraction: .395, frames: 6, spacing: 5 },
  aurora: { name: "極光水晶長廊", fraction: .67, frames: 8, spacing: 4 },
} as const;

/** A landmark belongs on a readable runway, with supports clear of every road. */
export function createCircuitSection(id: TrackId, route: readonly RaceRouteSample[], branches: readonly { samples: readonly TrackSample[]; width: number }[] = []) {
  const section = SECTION[id];
  let center = Math.round(route.length * section.fraction), best = Infinity;
  const halfSpan = Math.ceil((section.frames - 1) * section.spacing / 2);
  for (let candidate = halfSpan; candidate < route.length - halfSpan; candidate++) {
    const sample = route[candidate];
    if (Math.abs(sample.raceProgress - section.fraction) > .08) continue;
    let bend = 0, grade = 0, clear = true;
    for (let offset = -halfSpan; offset <= halfSpan; offset += 4) {
      const next = route[candidate + offset];
      bend = Math.max(bend, 1 - sample.tangent[0] * next.tangent[0] - sample.tangent[1] * next.tangent[1]);
      grade = Math.max(grade, Math.abs(next.height - sample.height));
      for (const side of [-1, 1]) {
        const support = sampleTrackSurface(next.position[0] + next.normal[0] * side * 6.4,
          next.position[1] + next.normal[1] * side * 6.4, route);
        if (support.distance < TRACK_CONFIG.roadWidth / 2 + 1.4) clear = false;
        const x = next.position[0] + next.normal[0] * side * 6.4;
        const z = next.position[1] + next.normal[1] * side * 6.4;
        if (branches.some(branch => distanceToTrack(x, z, branch.samples, { closed: false }) < branch.width / 2 + 1.4)) clear = false;
      }
    }
    if (!clear) continue;
    const score = Math.abs(sample.raceProgress - section.fraction) + bend * 2 + grade * .1;
    if (score < best) { best = score; center = candidate; }
  }
  if (!Number.isFinite(best)) throw new Error(`No clear landmark runway for ${id}`);
  const frames = Array.from({ length: section.frames }, (_, index) => {
    const offset = Math.round((index - (section.frames - 1) / 2) * section.spacing);
    const sample = route[(center + offset + route.length) % route.length];
    const yaw = Math.atan2(-sample.tangent[0], -sample.tangent[1]);
    return { position: [sample.position[0], sample.height, sample.position[1]] as const,
      yaw, ...roadOrientation(yaw, sampleTrackSurface(...sample.position, route)) };
  });
  return { ...section, frames };
}
