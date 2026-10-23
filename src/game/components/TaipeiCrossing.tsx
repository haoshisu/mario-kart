import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshBasicMaterial } from "three";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import { crossingPhase } from "../track/parkObstacle";
import { TaiwanBoxes, type TaiwanBox } from "./TaiwanProps";

/** Visual warnings share the physical shuttle's clock; the main road stays open. */
export function TaipeiCrossing() {
  const track = useTrack(), runtime = useTrackRuntimeRef();
  const lights = useRef<(MeshBasicMaterial | null)[]>([]);
  const layout = useMemo(() => {
    const branch = track.branches.find(branch => branch.id === "taipei-crossing");
    if (!branch) return null;
    const middle = branch.samples[Math.floor(branch.samples.length / 2)];
    const yaw = Math.atan2(-middle.tangent[0], -middle.tangent[1]);
    const boxes: TaiwanBox[] = [];
    boxes.push({position:[middle.position[0],middle.height-.35,middle.position[1]],scale:[3,.6,28],rotation:[0,yaw+Math.PI/2,0],color:"#677d78",surface:"concrete"});
    for(const offset of [-12,12]) boxes.push({position:[middle.position[0]+middle.normal[0]*offset,middle.height/2,middle.position[1]+middle.normal[1]*offset],
      scale:[1.6,middle.height,1.6],color:"#677d78",surface:"concrete"});
    for (const side of [-1,1]) boxes.push({ position:[middle.position[0] + middle.tangent[0] * side * .75, middle.height + .09, middle.position[1] + middle.tangent[1] * side * .75],
      scale:[.08,.05,28], rotation:[0,yaw + Math.PI/2,0], color:"#bbc4bf", surface:"metal" });
    for (let offset=-13;offset<=13;offset+=1.5) boxes.push({position:[middle.position[0]+middle.normal[0]*offset,middle.height+.035,middle.position[1]+middle.normal[1]*offset],
      scale:[.2,.06,2],rotation:[0,yaw,0],color:"#775c47",surface:"wood"});
    const signals = [-1,1].map(side => {
      const point=branch.samples[Math.floor(branch.samples.length*.25)];
      return {x:point.position[0]+point.normal[0]*4*side,y:point.height,z:point.position[1]+point.normal[1]*4*side,
        yaw:Math.atan2(-point.tangent[0],-point.tangent[1])};
    });
    return {boxes,signals};
  }, [track]);
  useFrame(() => {
    const phase = crossingPhase(runtime.current.seconds);
    for(let i=0;i<lights.current.length;i++) {
      const material=lights.current[i];
      if(material) material.color.set(i%3===0 ? phase==="crossing" ? "#ff5542" : "#351812"
        : i%3===1 ? phase==="warning" ? "#ffca53" : "#332816" : phase==="clear" ? "#66f4aa" : "#16322c");
    }
  });
  if(!layout) return null;
  return <group name="taipei-crossing-signals"><TaiwanBoxes boxes={layout.boxes} />
    {layout.signals.map((s,i)=><group key={i} position={[s.x,s.y,s.z]} rotation={[0,s.yaw,0]}>
      <mesh position={[0,1.4,0]}><boxGeometry args={[.14,2.8,.14]} /><meshStandardMaterial color="#48534f" /></mesh>
      <mesh position={[0,3,0]}><boxGeometry args={[.75,1.6,.35]} /><meshStandardMaterial color="#172725" /></mesh>
      {[0,1,2].map(level=><mesh key={level} position={[0,3.45-level*.45,.2]}><circleGeometry args={[.21,12]} />
        <meshBasicMaterial ref={node=>{lights.current[i*3+level]=node;}} toneMapped={false} /></mesh>)}
    </group>)}
  </group>;
}
