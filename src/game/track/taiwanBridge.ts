import type { RaceRouteSample } from "../core/race/raceTrack";
import type { TrackBranch } from "./meadowPark";
import { createOpenTrackSamples } from "./openTrackPath";
import { createTrackGeometry, type TrackMeshData } from "./trackGeometry";
import { sampleAtDistance, routeLength } from "./trackPlacement";
import { sampleTrackSurface, roadOrientation } from "./trackSurface";

export function createTaiwanBridge(route: readonly RaceRouteSample[]): TrackBranch {
  const length = routeLength(route), from = sampleAtDistance(route, length * .385), to = sampleAtDistance(route, length * .485);
  const outside = (point: RaceRouteSample, advance: number) => [point.position[0] + point.tangent[0] * advance - point.normal[0] * 14, point.position[1] + point.tangent[1] * advance - point.normal[1] * 14] as const;
  const a = outside(from, 24), b = outside(to, -24);
  const path = createOpenTrackSamples([
    [from.position,[from.position[0]+from.tangent[0]*8,from.position[1]+from.tangent[1]*8],[a[0]-from.tangent[0]*8,a[1]-from.tangent[1]*8],a],
    [a,[a[0]+from.tangent[0]*22,a[1]+from.tangent[1]*22],[b[0]-to.tangent[0]*22,b[1]-to.tangent[1]*22],b],
    [b,[b[0]+to.tangent[0]*8,b[1]+to.tangent[1]*8],[to.position[0]-to.tangent[0]*8,to.position[1]-to.tangent[1]*8],to.position],
  ],from,to).map(sample=>{
    const surface=sampleTrackSurface(...sample.position,route,undefined,{height:sample.height});
    const t=Math.max(0,Math.min(1,(surface.distance-8.5)/8)),blend=t*t*(3-2*t);
    const bank=Math.atan(sample.normal[0]*surface.gradientX+sample.normal[1]*surface.gradientZ);
    return {...sample,width:5.8,height:surface.height+(sample.height-surface.height)*blend,bank:bank+(sample.bank-bank)*blend};
  });
  return { id: "kaohsiung-rotation", name: "旋轉側橋獎勵線", movable: true, width: 5.8, samples: path, staticSections: [path.slice(0,Math.floor(path.length*.4)+1),path.slice(Math.ceil(path.length*.6))],
    entryProgress: from.raceProgress, exitProgress: to.raceProgress,
    geometry: createTrackGeometry(path,{closed:false,width:5.8,avoidRoads:[{samples:route,width:8.4}],railOpenings:[{side:-1,from:0,to:.18},{side:1,from:0,to:.18},{side:-1,from:.82,to:1},{side:1,from:.82,to:1}]}) };
}
export function bridgeParts(branch: TrackBranch) {
  const start = Math.floor(branch.samples.length * .4), end = Math.ceil(branch.samples.length * .6);
  const middle = branch.samples[Math.floor((start+end)/2)];
  const pivot = [middle.position[0],0,middle.position[1]] as const;
  const slices = [branch.samples.slice(0,start+1),branch.samples.slice(start,end+1),branch.samples.slice(end)];
  const geometries = slices.map(samples=>createTrackGeometry(samples,{closed:false,width:branch.width,railOpenings:[{side:-1,from:0,to:.07},{side:1,from:0,to:.07},{side:-1,from:.93,to:1},{side:1,from:.93,to:1}]}));
  // Preserve the validated merge openings from the full bridge ribbon.
  geometries.forEach(geometry=>{
    const first=geometry.ROAD_MESH_DATA.vertices, minX=Math.min(...Array.from(first).filter((_,i)=>i%3===0)), maxX=Math.max(...Array.from(first).filter((_,i)=>i%3===0));
    geometry.GUARD_RAIL_SEGMENTS=branch.geometry.GUARD_RAIL_SEGMENTS.filter(rail=>rail.position[0]>=minX-1 && rail.position[0]<=maxX+1 && slices[geometries.indexOf(geometry)].some(sample=>Math.hypot(sample.position[0]-rail.position[0],sample.position[1]-rail.position[2])<7));
  });
  const local = (mesh: TrackMeshData) => ({indices:mesh.indices,vertices:mesh.vertices.map((value,i)=>value-(i%3===0 ? pivot[0] : i%3===2 ? pivot[2] : 0))});
  const gates = [branch.samples[start],branch.samples[end]].map(sample=>({position:[sample.position[0],sample.height,sample.position[1]] as const,yaw:Math.atan2(-sample.tangent[0],-sample.tangent[1])}));
  return { pivot, geometries, slices, mesh:local(geometries[1].DRIVABLE_MESH_DATA), gates };
}
export type BridgeParts = ReturnType<typeof bridgeParts>;
export function bridgeOccupied(branch: TrackBranch, x:number,y:number,z:number) {
  const road=sampleTrackSurface(x,z,branch.samples,undefined,{closed:false,height:y});
  return road.distance<6 && Math.abs(road.height-y)<3 && (road.progress??0)>.12 && (road.progress??0)<.88;
}

export function bridgeBoostPads(branch: TrackBranch) {
  return Array.from({length:Math.ceil((branch.samples.length-21)/16)},(_,i)=>{
    const sample=branch.samples[Math.min(branch.samples.length-1,20+i*16)];
    const yaw=Math.atan2(-sample.tangent[0],-sample.tangent[1]);
    return { id: `bridge-pad-${i}`,position:sample.position,height:sample.height,yaw,...roadOrientation(yaw,sampleTrackSurface(...sample.position,branch.samples,undefined,{closed:false})) };
  });
}
