import {describe,expect,it} from "vitest";
import {getTrackData} from "./trackData";
import {createParkObstacle,parkObstaclePose,parkObstacleYaw,crossingPhase} from "./parkObstacle";
import {sampleTrackSurface} from "./trackSurface";
import {projectOntoRaceRoute} from "../core/race/progressSystem";
import {routeLength} from "./trackPlacement";
const track=getTrackData("taipei"),branch=track.branches[1];
describe("Taipei driving rhythm",()=>{
  it("has multiple width phrases plus broad fast/landing decks",()=>{
    expect(track.samples.filter(s=>(s.width??8.4)<8.3).length/track.samples.length).toBeGreaterThan(.3);
    const route=track.race.RACE_ROUTE_SAMPLES;
    for(const s of route.filter(s=>s.raceProgress>.48&&s.raceProgress<.64))expect(s.width).toBe(8.4);
    expect(routeLength(route)).toBeLessThan(1100);
  });
  it("crossing reward road stays within checkpoints and saves real distance",()=>{
    expect(branch.id).toBe("taipei-crossing");expect(branch.entryProgress).toBeGreaterThan(.25);expect(branch.exitProgress).toBeLessThan(.5);
    let length=0,previous=branch.entryProgress;
    for(let i=0;i<branch.samples.length;i++){
      const s=branch.samples[i],projection=projectOntoRaceRoute(s.position,track.race,s.height);
      expect(projection.fraction).toBeGreaterThanOrEqual(previous-.003);previous=projection.fraction;
      if(i)length+=Math.hypot(s.position[0]-branch.samples[i-1].position[0],s.position[1]-branch.samples[i-1].position[1]);
    }
    expect(routeLength(track.race.RACE_ROUTE_SAMPLES)*(branch.exitProgress-branch.entryProgress)-length).toBeGreaterThan(15);
  });
  it("warns before a continuous physical crossing that leaves the main road clear",()=>{
    const obstacle=createParkObstacle(track.race.RACE_ROUTE_SAMPLES,"taipei",branch.samples);
    expect(crossingPhase(1)).toBe("clear");expect(crossingPhase(3)).toBe("warning");expect(crossingPhase(5)).toBe("crossing");
    let previous=parkObstaclePose(obstacle,0);
    for(let t=.02;t<24;t+=.02){
      const p=parkObstaclePose(obstacle,t),surface=sampleTrackSurface(p.x,p.z,track.samples,undefined,{height:p.y-obstacle.dimensions.halfHeight});
      expect(surface.distance).toBeGreaterThan(8);
      expect(Math.hypot(p.x-previous.x,p.z-previous.z)).toBeLessThan(.3);previous=p;
      expect(parkObstacleYaw(obstacle,t)).toBe(obstacle.yaw);
    }
    const occupied=parkObstaclePose(obstacle,5);
    expect(Math.hypot(occupied.x-(obstacle.crossing?.position[0]??0),occupied.z-(obstacle.crossing?.position[1]??0))).toBeLessThan(.001);
  });
});
