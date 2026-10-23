import RAPIER from "@dimforge/rapier3d-compat";
import {beforeAll,expect,it} from "vitest";
import {SimulationSystem} from "./SimulationSystem";
import {botInput} from "./BotDriver";
import {sampleTrackSurface} from "../../src/game/track/trackSurface";

beforeAll(async()=>{await RAPIER.init();});
it("drives the timed reward bridge with normal input, collects boost and completes a legal lap",()=>{
  const simulation=new SimulationSystem(42,"kaohsiung");
  try{
    simulation.addPlayer("driver","Driver","coral");simulation.start();
    const bridge=simulation.track.bridge;if(!bridge)throw new Error("Missing bridge");
    const main=simulation.track.race.RACE_ROUTE_SAMPLES,branch=bridge.branch;
    const route=[...main.filter(p=>p.raceProgress<branch.entryProgress),...branch.samples.map(p=>({...p,distance:0,raceProgress:branch.entryProgress+p.progress*(branch.exitProgress-branch.entryProgress)})),...main.filter(p=>p.raceProgress>branch.exitProgress)];
    let visited=false,turbo=false,held=false;
    for(let step=0;step<140*60;step++){
      const snapshot=simulation.getSnapshot(),player=snapshot.players[0],now=simulation.getTick()*1000/60;
      const surface=sampleTrackSurface(player.position[0],player.position[2],branch.samples,undefined,{closed:false,height:player.position[1]-.52});
      if(surface.distance<2 && (surface.progress??0)>.35 && (surface.progress??0)<.65){visited=true;turbo ||= player.item.boostRemaining>0;held ||= (snapshot.bridge?.elapsed??0)>=12 && snapshot.bridge?.angle===0;}
      const input=botInput(player.position[0],player.position[2],player.yaw,player.speed,0,[],route,[],player.position[1]-.52);
      simulation.input.receive("driver",{sequence:simulation.getTick(),sentAt:now,input},now);simulation.step(now);
      if(player.completedLaps>=1)break;
    }
    expect(simulation.getSnapshot().players[0].completedLaps).toBe(1);expect({visited,turbo,held}).toEqual({visited:true,turbo:true,held:true});
  }finally{simulation.dispose();}
},20_000);
it("a closed bridge gate physically blocks access to its moving deck",()=>{
  const simulation=new SimulationSystem(42,"kaohsiung");
  try{
    simulation.addPlayer("driver","Driver","coral");simulation.start();
    for(let i=0;i<17*60;i++)simulation.step(i*1000/60);
    const bridge=simulation.track.bridge;if(!bridge)throw new Error("Missing bridge");
    const start=bridge.branch.samples[Math.floor(bridge.branch.samples.length*.3)];
    simulation.resetPlayerPose("driver",[start.position[0],start.height+.52,start.position[1]],Math.atan2(-start.tangent[0],-start.tangent[1]));
    let hit=false;
    const route=bridge.branch.samples.map(p=>({...p,distance:0,raceProgress:p.progress}));
    for(let i=0;i<3*60;i++){
      const player=simulation.getSnapshot().players[0],now=simulation.getTick()*1000/60;
      const input=botInput(player.position[0],player.position[2],player.yaw,player.speed,0,[],route,[],player.position[1]-.52);
      simulation.input.receive("driver",{sequence:simulation.getTick(),sentAt:now,input},now);simulation.step(now);hit ||= player.impactRevision>0;
    }
    expect(hit).toBe(true);expect(simulation.getSnapshot().bridge?.locked).toBe(false);
  }finally{simulation.dispose();}
},10_000);
