import { describe, expect, it } from "vitest";
import { createInitialKartState, stepKartSimulation } from "./kartPhysics";
import { getDriftSteering } from "./driftSystem";
import type { KartInput, KartSimulationState } from "./kartTypes";

const input: KartInput = {throttle:1,brake:0,steer:0,drift:false};
function advance(state: KartSimulationState, controls: KartInput, frames: number) {
  for(let i=0;i<frames;i++) state=stepKartSimulation(state,controls,1/60).state;
  return state;
}
describe("driving feel",()=>{
  it("neutral and countersteering cannot farm charge after entering a drift",()=>{
    const started=advance({...createInitialKartState(),speed:17},{...input,steer:.4,drift:true},1);
    for(const steer of [0,-1]){
      const held=advance(started,{...input,steer,drift:true},180);
      expect(held.drift.direction).toBe(1);
      expect(held.drift.charge).toBe(started.drift.charge);
      expect(held.drift.chargeTier).toBe(0);
    }
  });
  it("countersteer opens the same arc and releasing restores ordinary steering",()=>{
    const state=advance({...createInitialKartState(),speed:17},{...input,steer:1,drift:true},90);
    const outer=getDriftSteering(state.drift,-1),inner=getDriftSteering(state.drift,1);
    expect(outer).toBeGreaterThan(0); expect(outer).toBeLessThan(inner);
    const release=stepKartSimulation(state,{...input,steer:-1},1/60);
    expect(release.turboTriggered).toBe(true);expect(release.state.drift.direction).toBe(0);
    expect(getDriftSteering(release.state.drift,-1)).toBe(-1);
  });
  it("mirrors left/right steering and charging",()=>{
    const a=advance({...createInitialKartState(),speed:17},{...input,steer:1,drift:true},120);
    const b=advance({...createInitialKartState(),speed:17},{...input,steer:-1,drift:true},120);
    expect(a.yaw).toBeCloseTo(-b.yaw); expect(a.drift.charge).toBe(b.drift.charge);
  });
  it("leaves enough neutral arc for a long city bend without charging",()=>{
    const start={...createInitialKartState(),speed:17};
    const entered=advance(start,{...input,steer:1,drift:true},1);
    const neutral=advance(entered,{...input,drift:true},60);
    const radius=17/Math.abs(neutral.yaw-entered.yaw);
    expect(radius).toBeGreaterThan(30);expect(radius).toBeLessThan(45);
    expect(neutral.drift.charge).toBe(entered.drift.charge);
  });
  it("braking and reverse cancel drift without awarding turbo",()=>{
    const state=advance({...createInitialKartState(),speed:17},{...input,steer:1,drift:true},90);
    const brake=stepKartSimulation(state,{...input,brake:1},1/60);
    expect(brake.turboTriggered).toBe(false);expect(brake.state.drift.active).toBe(false);
    expect(advance({...createInitialKartState(),speed:-5},{...input,throttle:0,brake:1,steer:1,drift:true},90).drift.charge).toBe(0);
  });
  it("retains momentum smoothly after turbo and external boost end",()=>{
    for(const state of [{...createInitialKartState(),speed:23},
      {...createInitialKartState(),speed:23,drift:{...createInitialKartState().drift,turboTier:3 as const,turboRemaining:.001}}]){
      const next=stepKartSimulation(state,input,1/60).state;
      expect(next.speed).toBeGreaterThan(22.5);expect(next.speed).toBeLessThan(23);
      const settled=advance(next,input,90);
      expect(settled.speed).toBeLessThan(17.03);expect(settled.speed).toBeGreaterThanOrEqual(17);
    }
  });
  it("never adds lost impact speed back and braking defeats carried momentum",()=>{
    const impacted={...createInitialKartState(),speed:8};
    expect(stepKartSimulation(impacted,input,1/60).state.speed).toBeLessThan(8.3);
    const fast={...createInitialKartState(),speed:23};
    const brake=stepKartSimulation(fast,{...input,throttle:0,brake:1},1/60).state;
    expect(brake.speed).toBeLessThanOrEqual(22.7);
  });
  it("soft release is stable at different fixed step sizes",()=>{
    const start={...createInitialKartState(),speed:23};
    let a=start,b=start;
    for(let i=0;i<60;i++)a=stepKartSimulation(a,input,1/60).state;
    for(let i=0;i<120;i++)b=stepKartSimulation(b,input,1/120).state;
    expect(a.speed).toBeCloseTo(b.speed,6);
  });
  it.each([0.25, 1])("brake %s retains full authority over stacked boosts and road assistance", (brake) => {
    const start = { ...createInitialKartState(), speed: 12 };
    const boosted = { ...start, drift: { ...start.drift, turboTier: 3 as const, turboRemaining: 1.5 } };
    const controls = { ...input, brake };
    const baseline = stepKartSimulation(start, controls, 1 / 60);
    const result = stepKartSimulation(boosted, controls, 1 / 60,
      { acceleration: 10, maximumSpeed: 23 }, { acceleration: 4 });
    expect(result.state.speed).toBeCloseTo(baseline.state.speed, 10);
    expect(result.state.speed).toBeLessThan(start.speed);
    expect(result.state.drift.turboRemaining).toBeLessThan(boosted.drift.turboRemaining);
  });
  it("can stop and reverse while boost remains active", () => {
    let state: KartSimulationState = { ...createInitialKartState(), speed: 3,
      drift: { ...createInitialKartState().drift, turboTier: 3 as const, turboRemaining: 1.5 } };
    for (let frame = 0; frame < 30; frame++) {
      state = stepKartSimulation(state, { ...input, brake: 1 }, 1 / 60,
        { acceleration: 10, maximumSpeed: 23 }).state;
    }
    expect(state.speed).toBeLessThan(-1);
    expect(state.drift.turboRemaining).toBeGreaterThan(0);
  });
  it("boost does not change reverse braking, but resumes after forward travel returns", () => {
    const start = { ...createInitialKartState(), speed: -2 };
    const boost = { acceleration: 10, maximumSpeed: 23 };
    expect(stepKartSimulation(start, input, 1 / 60, boost).state.speed)
      .toBe(stepKartSimulation(start, input, 1 / 60).state.speed);
    const stopped = { ...start, speed: 0 };
    expect(stepKartSimulation(stopped, input, 1 / 60, boost).state.speed)
      .toBeGreaterThan(stepKartSimulation(stopped, input, 1 / 60).state.speed);
  });
});
