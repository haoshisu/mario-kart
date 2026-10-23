import {describe,it,expect} from "vitest";
import {createStuntState,stepStuntLaunch,updateStuntTrick,finishStunt,stuntProgress} from "./stuntSystem";
const ramp={id:"test",position:[0,0] as const,height:0,yaw:-Math.PI/2,pitch:0,roll:0,forward:[1,0] as const};
function launch(held=false){
  const state=createStuntState(true);
  updateStuntTrick(state,held,true,1/60);
  if(held) for(let i=0;i<30;i++)updateStuntTrick(state,true,true,1/60);
  stepStuntLaunch(state,-.2,1.32,0,ramp.yaw,12,[ramp],true,1/60);
  stepStuntLaunch(state,.1,1.32,0,ramp.yaw,12,[ramp],true,1/60);
  return state;
}
describe("timed jump tricks",()=>{
  it("launches and lands normally without awarding an automatic trick",()=>{
    const state=launch();expect(state.active).toBe(true);expect(state.trickSucceeded).toBe(false);
    state.elapsed=1;expect(stuntProgress(state)).toBe(.001);
    expect(finishStunt(state,.1,-2,0)).toBe(true);expect(state.trickSucceeded).toBe(false);
  });
  it("accepts a fresh early-air tap and rejects held or late input",()=>{
    const held=launch(true);updateStuntTrick(held,true,true,1/60);expect(held.trickSucceeded).toBe(false);
    const good=launch();good.elapsed=.12;updateStuntTrick(good,true,true,1/60);expect(good.trickSucceeded).toBe(true);
    good.elapsed=.6;expect(stuntProgress(good)).toBeGreaterThan(.4);
    const late=launch();late.elapsed=.3;updateStuntTrick(late,true,true,1/60);expect(late.trickSucceeded).toBe(false);
  });
  it("buffers a tap just before the lip and resets on a new race",()=>{
    const state=launch();state.active=false;state.cooldown=0;
    updateStuntTrick(state,true,true,1/60);
    stepStuntLaunch(state,-.1,1.32,0,ramp.yaw,12,[ramp],true,1/60);
    stepStuntLaunch(state,.1,1.32,0,ramp.yaw,12,[ramp],true,1/60);
    expect(state.trickSucceeded).toBe(true);expect(createStuntState(true).trickSucceeded).toBe(false);
  });
});
