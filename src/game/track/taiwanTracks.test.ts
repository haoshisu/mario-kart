import { describe,expect,it } from "vitest";
import { getTrackData } from "./trackData";
import { TAIWAN_TRACK_IDS } from "./taiwanTracks";
import { TAIWAN_DISTRICTS } from "./taiwanDesign";
import { taiwanLandmarkSpots } from "./taiwanEnvironment";
import { routeLength } from "./trackPlacement";
import { railObstructsRoad } from "./trackGeometry";
import { sampleTrackSurface } from "./trackSurface";
import { projectOntoRaceRoute } from "../core/race/progressSystem";
import { createParkObstacle,parkObstaclePose } from "./parkObstacle";
import { courseHandling,COURSE_MECHANICS } from "./courseDesign";
import { BRIDGE_TIMING } from "../systems/rotatingBridge";

for(const id of TAIWAN_TRACK_IDS) describe(`${id} Taiwan course`,()=>{
  const track=getTrackData(id),branch=track.branches[0];
  it("has eight contiguous districts, major elevation and a verified side jump",()=>{
    const districts=TAIWAN_DISTRICTS[id];expect(districts).toHaveLength(8);
    expect(districts[0].from).toBe(0);expect(districts[7].to).toBe(1);
    districts.forEach((p,i)=>{if(i)expect(p.from).toBe(districts[i-1].to);});
    expect(Math.max(...track.samples.map(p=>p.height))).toBeGreaterThanOrEqual(28);
    expect(track.ramps[0].launchSpeed).toBe(7.5);
    expect(()=>taiwanLandmarkSpots(track,id)).not.toThrow();
  });
  it("has a shorter branch with continuous slopes, legal progress and unobstructed merges",()=>{
    expect(Math.floor(branch.entryProgress*4)).toBe(Math.floor(branch.exitProgress*4));
    let length=0,previous=branch.entryProgress;
    for(let i=0;i<branch.samples.length;i++) {
      const p=branch.samples[i];
      const projection=projectOntoRaceRoute(p.position,track.race,p.height);
      expect(projection.fraction).toBeGreaterThanOrEqual(previous-.003);previous=projection.fraction;
      if(i){const before=branch.samples[i-1],distance=Math.hypot(p.position[0]-before.position[0],p.position[1]-before.position[1]);length+=distance;expect(Math.abs(p.height-before.height)/distance).toBeLessThan(.4);}
    }
    expect((branch.exitProgress-branch.entryProgress)*routeLength(track.race.RACE_ROUTE_SAMPLES)-length).toBeGreaterThan(8);
    for(const rail of branch.geometry.GUARD_RAIL_SEGMENTS)expect(railObstructsRoad(rail,{samples:track.samples,width:8.4})).toBe(false);
    for(const rail of track.geometry.GUARD_RAIL_SEGMENTS)expect(railObstructsRoad(rail,{samples:branch.samples,width:branch.width,closed:false})).toBe(false);
  });
  it("keeps the themed moving obstacle outside a centreline kart's clearance",()=>{
    const obstacle=createParkObstacle(track.race.RACE_ROUTE_SAMPLES,id);
    for(let t=0;t<=9;t+=.1){const p=parkObstaclePose(obstacle,t),surface=sampleTrackSurface(p.x,p.z,track.samples,undefined,{height:p.y-obstacle.dimensions.halfHeight});
      expect((surface.lateral??0)+obstacle.dimensions.halfWidth+.58).toBeLessThan(-.2);
    }
  });
});

it("waves change grip with time while the dry lane remains unaffected",()=>{
  for(const id of ["jiufen","kaohsiung"] as const){
    const mechanic=COURSE_MECHANICS[id],surface={height:8,distance:2,width:8.4,gradientX:0,gradientZ:0,progress:(mechanic.from+mechanic.to)/2,lateral:-2};
    expect(courseHandling(id,surface,true,0,2)?.grip).toBe(.4);
    expect(courseHandling(id,surface,true,0,6)).toBeUndefined();
    expect(courseHandling(id,{...surface,lateral:2},true,0,2)).toBeUndefined();
  }
});

it("the rotating bridge's swept deck clears the main road and its rewards lie on the branch",()=>{
  const track=getTrackData("kaohsiung"),bridge=track.bridge;
  if(!bridge)throw new Error("Missing rotating bridge");
  expect(bridge.branch.entryProgress).toBeGreaterThan(.25);expect(bridge.branch.exitProgress).toBeLessThan(.5);
  for(let angle=0;angle<=BRIDGE_TIMING.angle;angle+=.01)for(const point of bridge.slices[1]){
    const dx=point.position[0]-bridge.pivot[0],dz=point.position[1]-bridge.pivot[2];
    const x=bridge.pivot[0]+Math.cos(angle)*dx+Math.sin(angle)*dz,z=bridge.pivot[2]-Math.sin(angle)*dx+Math.cos(angle)*dz;
    const road=sampleTrackSurface(x,z,track.samples,undefined,{height:point.height});
    expect(road.distance,`deck angle ${angle}`).toBeGreaterThan(8);
  }
  const pads=track.items.BOOST_PADS.filter(pad=>pad.id.startsWith("bridge-pad"));expect(pads.length).toBeGreaterThanOrEqual(6);
  for(const pad of pads){const road=sampleTrackSurface(...pad.position,bridge.branch.samples,undefined,{closed:false,height:pad.height});expect(road.distance).toBeLessThan(.01);expect(road.height).toBeCloseTo(pad.height,3);}
});
