import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, PlaneGeometry, SphereGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TrackData } from "../track/trackData";
import { createTainanWorld } from "../track/tainanWorld";
import { addTainanHouse } from "./tainanArchitectureGeometry";
import { pointAtTrackOffset } from "../track/trackPath";

export function tainanWorldGeometry(track: TrackData, low: boolean) {
  const world = createTainanWorld(track), parts: BufferGeometry[] = [];
  function add(g: BufferGeometry, tint: string) {
    const c = new Color(tint), colors = new Float32Array(g.attributes.position.count * 3);
    for(let i=0;i<colors.length;i+=3)c.toArray(colors,i);
    g.setAttribute("color",new Float32BufferAttribute(colors,3));g.deleteAttribute("uv");
    // Terrain is non-indexed; normalize attributes for one merged draw call.
    parts.push(g.index ? g.toNonIndexed() : g); if(g.index)g.dispose();
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>add(new BoxGeometry(w,h,d).translate(x,y,z),c);
  const floor=(x:number,y:number,z:number,w:number,d:number,c:string)=>add(new PlaneGeometry(w,d).rotateX(-Math.PI/2).translate(x,y,z),c);
  const roof=(x:number,y:number,z:number,w:number,d:number,c:string)=>{
    for(const side of [-1,1]){
      const panel=low?new PlaneGeometry(w/2+.7,d+1.6).rotateX(-Math.PI/2):new BoxGeometry(w/2+.7,.4,d+1.6);
      add(panel.rotateZ(-side*.29).translate(x+side*w/4,y,z),c);
    }
  };
  // Continuous sloped city foundations, with an actual open channel through them.
  const vertices:number[]=[], colors:number[]=[];
  const step=8;
  const roadPoints=[track.samples,...track.branches.map(b=>b.samples)].flatMap(road=>road.filter((_,i)=>i%6===0));
  for(let z=-190;z<440;z+=step)for(let x=-300;x<292;x+=step){
    const coords=[[x,z],[x+step,z],[x,z+step],[x+step,z+step]];
    const inside=coords.every(([a,b])=>((a+5)/290)**2+((b-125)/310)**2<1);
    if(!inside)continue;
    const streetCell=roadPoints.some(p=>Math.hypot(x+step/2-p.position[0],z+step/2-p.position[1])<16);
    // Water fills the skipped cells; banks terminate above a recessed bed.
    if(z+step>133&&z<159)continue;
    for(const i of [0,2,1,1,2,3]){
      const [a,b]=coords[i];vertices.push(a,streetCell?-.9:world.ground(a,b),b);
      const c=new Color(z>160?"#be9871":"#ccaa81");c.toArray(colors,colors.length);
    }
  }
  const terrain=new BufferGeometry();terrain.setAttribute("position",new Float32BufferAttribute(vertices,3));terrain.computeVertexNormals();
  terrain.setAttribute("color",new Float32BufferAttribute(colors,3));parts.push(terrain);
  // Follow the real road deck through slopes; a coarse terrain grid must never
  // interpolate across the lane and cover it near elevated merges.
  for(const road of [track.samples,...track.branches.map(b=>b.samples)]){
    const ribbon:number[]=[];
    const samples=road.filter((_,i)=>i%2===0);
    if(road===track.samples)samples.push(road[0]);
    for(let i=1;i<samples.length;i++){
      const points:number[][]=[];
      for(const p of [samples[i-1],samples[i]])for(const offset of [-17,-5.5,5.5,17]){
        const [x,z]=pointAtTrackOffset(p,offset);
        if(Math.abs(z-146)<14){points.push([x,-4,z]);continue;}
        const deck=p.height+Math.tan(p.bank)*offset-.45;
        points.push([x,Math.abs(offset)>6?Math.min(deck,world.ground(x,z)):deck,z]);
      }
      for(let lane=0;lane<3;lane++)for(const index of [lane,lane+1,lane+4,lane+1,lane+5,lane+4])ribbon.push(...points[index]);
    }
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(ribbon,3));g.computeVertexNormals();add(g,"#c9a67d");
  }
  // Retaining quays establish the water's depth and lead the eye through town.
  for(const z of [132,160])for(let x=-265;x<265;x+=8){
    const h=Math.max(0,world.ground(x,z));
    box(x,h/2-2,z,8,h+4,1.5,"#986f54");
    floor(x,h+.04,z+(z<146?-3:3),8,6,"#e1be8d");
  }
  world.houses.forEach(b => addTainanHouse(b, low, add));
  for (const court of world.courts) {
    const {x,y,z}=court;
    floor(x,y+.05,z,15.9,17.5,"#b4a278");
    floor(x,y+.08,z,10,11,"#71865a");
    box(x,y+.3,z,5,.6,5,"#b58c64");
    add(new CylinderGeometry(.4,.7,5,5).translate(x,y+2.8,z),"#796044");
    for(const [dx,dz,r] of [[-2,0,3.4],[2,1,3.1],[0,-2,3]])
      add(new SphereGeometry(r,low?5:7,4).scale(1,.7,1).translate(x+dx,y+6,z+dz),"#688352");
    for(const side of [-1,1])box(x+side*5.8,y+.6,z,1,1.2,7,"#dbc39a");
  }
  // The road widens visually into the temple forecourt; the hall closes its vista.
  const t=world.temple;
  floor(t.x,t.y+.1,t.z,78,80,"#e3bd8c");
  for(let i=-4;i<=4;i++){
    floor(t.x+i*8,t.y+.12,t.z, .16,76,"#b78562");floor(t.x,t.y+.13,t.z+i*8,76,.16,"#b78562");
  }
  for(const side of [-1,1]){
    box(t.x+side*32,t.y+5,t.z,10,10,66,"#bc7350");roof(t.x+side*32,t.y+11,t.z,12,68,"#8b4936");
    for(let k=-3;k<=3;k++)box(t.x+side*26,t.y+2.5,t.z+k*8,.6,5,.6,"#edc78d");
  }
  for(let tier=0;tier<3;tier++){
    box(t.x,t.y+6+tier*6,t.z+24,36-tier*8,9,20-tier*3,"#b96640");
    roof(t.x,t.y+12+tier*6,t.z+24,44-tier*8,26-tier*3,"#81402e");
  }
  // Cross the canal on a masonry causeway; the same existing driving deck remains authoritative.
  for(const p of track.samples.filter((_,i)=>i%5===0)){
    if(Math.abs(p.position[1]-146)>24)continue;
    const yaw=Math.atan2(-p.tangent[0],-p.tangent[1]);
    for(const side of [-1,1]){
      const [x,z]=pointAtTrackOffset(p,side*5.8);
      add(new BoxGeometry(1.3,p.height+4,5.1).rotateY(yaw).translate(x,(p.height-4)/2,z),"#a07856");
      add(new BoxGeometry(1.7,.4,5.1).rotateY(yaw).translate(x,p.height+.25,z),"#e4c08c");
    }
  }
  // Festival ropes belong to the narrow old-town streets, framing the next bend.
  for(const fraction of [.025,.075,.11,.91,.955]){
    const p=track.race.RACE_ROUTE_SAMPLES[Math.floor(track.race.RACE_ROUTE_SAMPLES.length*fraction)];
    const angle=Math.atan2(-p.tangent[0],-p.tangent[1]);
    add(new BoxGeometry(23,.06,.06).rotateY(angle).translate(p.position[0],p.height+8,p.position[1]),"#634d35");
    for(const offset of [-8,-4,0,4,8]){
      const [x,z]=pointAtTrackOffset(p,offset);
      add(new CylinderGeometry(.55,.55,.85,6).translate(x,p.height+7.3,z),"#e9a34e");
      box(x,p.height+7.85,z,.15,.4,.15,"#674832");
    }
  }
  for(const x of [-100,70]){
    box(x,-1.7,146,12,1.2,4,"#795740");box(x,-.8,146,6,1.5,3.2,"#d3aa72");roof(x,.2,146,7,4,"#925c3e");
  }
  const g=world.gate, yaw=Math.atan2(-g.tangent[0],-g.tangent[1]);
  const gateBox=(dx:number,dy:number,w:number,h:number,d:number,c:string)=>add(new BoxGeometry(w,h,d).translate(dx,dy,0).rotateY(yaw).translate(g.position[0],g.height,g.position[1]),c);
  for(const side of [-1,1])gateBox(side*10,6,8,12,10,"#b7734d");
  gateBox(0,13,28,3,10,"#bc7b52");gateBox(0,17,17,5,9,"#dca16a");
  add(new BoxGeometry(29,.8,15).rotateY(yaw).translate(g.position[0],g.height+20,g.position[1]),"#844832");
  // A broad city wall supports the high northern district, instead of an isolated flyover.
  for(const p of track.race.RACE_ROUTE_SAMPLES.filter((p,i)=>p.raceProgress>.62&&p.raceProgress<.77&&i%6===0)){
    const [x,z]=pointAtTrackOffset(p,-6.2);
    add(new BoxGeometry(2,p.height+3,6.1).rotateY(Math.atan2(-p.tangent[0],-p.tangent[1])).translate(x,(p.height-3)/2,z),"#b47d54");
  }
  // Coastal groves soften the city boundary; no unrelated mountain backdrop.
  for(let i=0;i<70;i++){
    const a=i*Math.PI*2/70,x=-5+Math.cos(a)*278,z=125+Math.sin(a)*297;
    if(Math.abs(z-146)<22)continue;
    const y=world.ground(x,z);
    add(new CylinderGeometry(.6,1,7,5).translate(x,y+3,z),"#8b7150");
    add(new SphereGeometry(5,low?5:7,4).scale(1,.7,1).translate(x,y+7,z),"#6c8a58");
  }
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());return geometry;
}
