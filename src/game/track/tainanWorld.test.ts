import { expect, it } from "vitest";
import { getTrackData } from "./trackData";
import { createTainanWorld } from "./tainanWorld";
import { tainanWorldGeometry } from "../rendering/tainanWorldGeometry";
import { distanceToTrack } from "./trackPath";
const track=getTrackData("tainan"),world=createTainanWorld(track);
it("forms connected urban rows while keeping homes outside every driving ribbon",()=>{
  expect(world.houses.length).toBeGreaterThan(350);
  for(const b of world.houses)for(const road of [track.samples,...track.branches.map(b=>b.samples)]){
    expect(distanceToTrack(b.x,b.z,road,{closed:road===track.samples})).toBeGreaterThan(15.7);
    expect(Number.isFinite(b.y)).toBe(true);
  }
});
it("cuts the canal through the city and keeps street foundations below the road",()=>{
  expect(world.ground(0,146)).toBe(-4);
  for(const p of track.samples.filter((_,i)=>i%6===0))expect(world.ground(...p.position)).toBeLessThan(p.height);
});
it("keeps both complete skyline variants within their geometry budget",()=>{
  for(const low of [false,true]){
    const g=tainanWorldGeometry(track,low);
    expect(g.attributes.position.count/3).toBeLessThan(low?45000:75000);
    expect(Array.from(g.attributes.position.array).every(Number.isFinite)).toBe(true);g.dispose();
  }
});
