import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Mesh, MeshStandardMaterial, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cityDetailPlacements } from "../track/taiwanCity";
import { architecturePlacements } from "../track/taiwanArchitecture";
import { getTrackData } from "../track/trackData";

describe("Taiwan city dressing fits its existing safe envelopes", () => {
  it.each(["taiwan-city-v1", "taiwan-city-low-v1"])("%s exports bounded original modules with shared materials", async name => {
    const bytes = readFileSync(`public/models/${name}.glb`);
    expect(bytes.length).toBeLessThan(1_500_000);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    gltf.scene.updateMatrixWorld(true);
    const materials = new Set(), modules = new Set();
    let triangles = 0;
    const vertex = new Vector3();
    gltf.scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const module = node.name.split("_")[0]; modules.add(module);
      expect(node.material).toBeInstanceOf(MeshStandardMaterial); materials.add(node.material);
      expect(node.geometry.attributes.color).toBeDefined();
      const positions = node.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
        expect([vertex.x, vertex.y, vertex.z].every(Number.isFinite)).toBe(true);
        expect(vertex.y).toBeGreaterThanOrEqual(-.001);
        expect(Math.hypot(vertex.x, vertex.z)).toBeLessThan(module === "harbor" ? 11.5 : 6.5);
      }
      expect(Array.from(node.geometry.attributes.normal.array).every(Number.isFinite)).toBe(true);
      triangles += (node.geometry.index?.count ?? positions.count) / 3;
    });
    expect(modules).toEqual(new Set(["street", "tea", "harbor"]));
    expect(materials.size).toBe(2);
    expect(triangles).toBeLessThan(name.includes("low") ? 7000 : 15000);
  });
  it.each(["taipei", "jiufen", "kaohsiung"] as const)("%s dresses side buildings without blocking portals or stacked landmarks", id => {
    const buildings = architecturePlacements(getTrackData(id), id);
    const placements = cityDetailPlacements(buildings);
    expect(placements.length).toBeGreaterThan(5);
    for (const p of placements) {
      expect(p.portal).toBeFalsy(); expect(p.radius).toBeLessThan(14);
      expect(buildings.some(b => b.position === p.position && b.yaw === p.yaw)).toBe(true);
    }
  });
  it("leaves the forest map unchanged", () => {
    expect(cityDetailPlacements(architecturePlacements(getTrackData("alishan"), "alishan"))).toEqual([]);
  });
});
