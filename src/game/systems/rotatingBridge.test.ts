import {expect,it} from "vitest";
import {BRIDGE_TIMING,createBridgeState,stepBridge} from "./rotatingBridge";

it("waits for every racer to leave before raising gates and rotating",()=>{
  const state=createBridgeState();
  for(let i=0;i<30*60;i++)stepBridge(state,1/60,true);
  expect(state.elapsed).toBeCloseTo(BRIDGE_TIMING.open);expect(state.angle).toBe(0);expect(state.locked).toBe(true);expect(state.gateHeight).toBe(-4);
  let turned=false,returned=false,previouslyTurned=false;
  for(let i=0;i<28*60;i++){
    stepBridge(state,1/60,false);
    if(state.angle>0){turned=true;previouslyTurned=true;expect(state.gateHeight).toBeCloseTo(1.2);expect(state.locked).toBe(false);}
    if(previouslyTurned&&state.open){returned=true;expect(state.angle).toBe(0);expect(state.locked).toBe(true);}
  }
  expect(turned&&returned).toBe(true);
});
it("clamps long frame gaps and keeps all gate and deck poses bounded",()=>{
  const state=createBridgeState();stepBridge(state,10,false);expect(state.elapsed).toBe(.05);
  for(let i=0;i<40*60;i++){stepBridge(state,1/60,false);expect(state.angle).toBeGreaterThanOrEqual(0);expect(state.angle).toBeLessThanOrEqual(BRIDGE_TIMING.angle);expect(state.gateHeight).toBeGreaterThanOrEqual(-4);expect(state.gateHeight).toBeLessThanOrEqual(1.2+1e-9);}
});
