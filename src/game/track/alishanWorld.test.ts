import { expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from "three";
import { getTrackData } from "./trackData";
import { alishanWorldGeometry } from "../rendering/alishanWorldGeometry";

it("keeps Alishan's continuous forest below and outside every driving route", () => {
  const track = getTrackData("alishan"), material = new MeshBasicMaterial({ side: DoubleSide });
  for (const low of [false, true]) {
    const geometry = alishanWorldGeometry(track, low);
    expect((geometry.index?.count ?? geometry.attributes.position.count) / 3).toBeLessThan(low ? 24000 : 42000);
    expect(Array.from(geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
    const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld();
    const ray = new Raycaster(), down = new Vector3(0, -1, 0);
    for (const road of [track.samples, ...track.branches.map(b => b.samples)]) for (const p of road.filter((_, i) => i % 10 === 0)) {
      ray.set(new Vector3(p.position[0], 300, p.position[1]), down);
      const hit = ray.intersectObject(mesh)[0];
      expect(hit, "the world must extend under every road").toBeDefined();
      expect(hit.point.y).toBeLessThan(p.height);
    }
    geometry.dispose();
  }
  material.dispose();
});
