import { CuboidCollider, RigidBody, TrimeshCollider, useBeforePhysicsStep, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useRef } from "react";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import { bridgeOccupied } from "../track/taiwanBridge";
import { stepBridge } from "../systems/rotatingBridge";
import { KART_CONFIG } from "../core/kart/kartConfig";

export function RotatingBridgeBody() {
  const track=useTrack(),runtimeRef=useTrackRuntimeRef(),{world}=useRapier();
  const deck=useRef<RapierRigidBody>(null),gates=useRef<(RapierRigidBody|null)[]>([]);
  const bridge=track.bridge;
  useBeforePhysicsStep(()=>{
    const state=runtimeRef.current.bridge;
    if(!bridge || !state) return;
    let occupied=false;
    world.forEachRigidBody(body=>{
      if(!body.isDynamic()) return;
      const p=body.translation();occupied ||= bridgeOccupied(bridge.branch,p.x,p.y-.52,p.z);
    });
    stepBridge(state,KART_CONFIG.fixedTimeStep,occupied);
    deck.current?.setNextKinematicRotation({x:0,y:Math.sin(state.angle/2),z:0,w:Math.cos(state.angle/2)});
    gates.current.forEach((body,i)=>body?.setNextKinematicTranslation({x:bridge.gates[i].position[0],y:bridge.gates[i].position[1]+state.gateHeight,z:bridge.gates[i].position[2]}));
  });
  if(!bridge) return null;
  return <>
    <RigidBody ref={deck} type="kinematicPosition" colliders={false} position={[...bridge.pivot]}>
      <TrimeshCollider args={[bridge.mesh.vertices,bridge.mesh.indices]} friction={0} name="track-road" />
      {bridge.geometries[1].GUARD_RAIL_SEGMENTS.map((rail,i)=><CuboidCollider key={i}
        args={[rail.size[0]/2,rail.size[1]/2,rail.size[2]/2]} position={[rail.position[0]-bridge.pivot[0],rail.position[1],rail.position[2]-bridge.pivot[2]]}
        rotation={[0,rail.rotationY,rail.rotationZ]} friction={0} restitution={.12} name="track-guard" />)}
    </RigidBody>
    {bridge.gates.map((gate,i)=><RigidBody key={i} ref={body=>{gates.current[i]=body;}} type="kinematicPosition" colliders={false}
      position={[gate.position[0],gate.position[1]-4,gate.position[2]]} rotation={[0,gate.yaw,0]}>
      <CuboidCollider args={[3,1,.25]} friction={0} restitution={.12} name="track-guard" />
    </RigidBody>)}
  </>;
}
