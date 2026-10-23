import {describe,expect,it} from "vitest";
import {drivingMix,DrivingSoundCues} from "./drivingSound";
it("raises pitch and wind with speed, adds drift tires and silences inactive racing",()=>{
  const slow=drivingMix(4,false,false,true),fast=drivingMix(17,true,true,true);
  expect(fast.frequency).toBeGreaterThan(slow.frequency);expect(fast.wind).toBeGreaterThan(slow.wind);
  expect(fast.tires).toBeGreaterThan(0);expect(slow.tires).toBe(0);
  expect(drivingMix(23,true,true,false)).toMatchObject({engine:0,wind:0,tires:0});
  expect(drivingMix(NaN,true,false,true).wind).toBe(0);
});
describe("driving sound edges",()=>{
  it("announces tier and boost once, allowing a new drift after release",()=>{
    const cues=new DrivingSoundCues();
    expect(cues.collect(1,false,true)).toEqual(["drift1"]);
    expect(cues.collect(1,false,true)).toEqual([]);
    expect(cues.collect(2,false,true)).toEqual(["drift2"]);
    expect(cues.collect(0,true,true)).toEqual(["boost"]);
    expect(cues.collect(0,true,true)).toEqual([]);
    cues.collect(0,false,true);
    expect(cues.collect(1,false,true)).toEqual(["drift1"]);
  });
  it("does not announce inactive effects",()=>{expect(new DrivingSoundCues().collect(3,true,false)).toEqual([]);});
  it("raises tail wind gradually and announces ready and each overtake once",()=>{
    expect(drivingMix(14,false,false,true,1).wind).toBeGreaterThan(drivingMix(14,false,false,true,.3).wind);
    expect(drivingMix(14,false,false,false,1).wind).toBe(0);
    const cues=new DrivingSoundCues(), draft={charge:.5,ready:false,boostRemaining:0,boostRevision:0};
    expect(cues.collect(0,false,true,draft)).toEqual([]);
    expect(cues.collect(0,false,true,{...draft,ready:true})).toEqual(["draftReady"]);
    expect(cues.collect(0,false,true,{...draft,ready:true})).toEqual([]);
    expect(cues.collect(0,true,true,{...draft,boostRemaining:.7,boostRevision:1})).toEqual(["draftBoost"]);
    expect(cues.collect(0,true,true,{...draft,boostRemaining:.6,boostRevision:1})).toEqual([]);
  });
});
