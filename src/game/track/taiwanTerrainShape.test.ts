import { describe, expect, it } from "vitest";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { getTrackData } from "./trackData";
import { architecturePlacements } from "./taiwanArchitecture";
import { taiwanSlopeVertices } from "./taiwanTerrainShape";

it("forest roots meet the rendered ground instead of the elevated road height", () => {
  const track = getTrackData("alishan"), geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(taiwanSlopeVertices(track), 3));
  const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const ray = new Raycaster(), origin = new Vector3(), down = new Vector3(0, -1, 0);
  const trees = architecturePlacements(track, "alishan").filter(p => p.module === "cedar");
  expect(trees.length).toBeGreaterThan(20);
  expect(trees.some(p => p.position[1] > 20)).toBe(true);
  for (const tree of trees) {
    origin.set(tree.position[0], 150, tree.position[2]); ray.set(origin, down);
    const surface = ray.intersectObject(mesh, false)[0];
    expect(tree.position[1]).toBeCloseTo(Math.max(0, surface?.point.y ?? 0), 3);
  }
  geometry.dispose(); material.dispose();
});

describe("mountain cut surfaces", () => {
  it.each(["jiufen", "alishan"] as const)("%s provides finite contiguous soil triangles", id => {
    const vertices = taiwanSlopeVertices(getTrackData(id));
    expect(vertices.length).toBeGreaterThan(1000);
    expect(vertices.length % 9).toBe(0);
    expect(vertices.every(Number.isFinite)).toBe(true);
  });
});
