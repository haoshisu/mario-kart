import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

describe("original Taiwan environment exports", () => {
  it.each(["taiwan-environment-v1", "taiwan-environment-low-v1"])("%s has finite UVs, shared materials and an open driving vault", async name => {
    const data = readFileSync(`public/models/${name}.glb`);
    expect(data.length).toBeLessThan(1_600_000);
    const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), "");
    gltf.scene.updateMatrixWorld(true);
    let triangles = 0;
    const materials = new Set<MeshStandardMaterial>(), gate: Mesh[] = [], warehouse: Mesh[] = [];
    gltf.scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      expect(node.material).toBeInstanceOf(MeshStandardMaterial);
      if (node.material instanceof MeshStandardMaterial) materials.add(node.material);
      expect(node.geometry.attributes.color).toBeDefined();
      for (const attribute of ["position", "normal", "uv"]) expect(Array.from(node.geometry.attributes[attribute].array).every(Number.isFinite)).toBe(true);
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      if (node.name.startsWith("gate_")) gate.push(node);
      if (node.name.startsWith("warehouse_")) warehouse.push(node);
    });
    expect(materials.size).toBe(8);
    expect(triangles).toBeLessThan(name.includes("low") ? 11000 : 16000);
    for (const structure of [gate, warehouse]) {
      // Sweeping kart-height rays through the opening catches an accidentally
      // exported solid wall; the vault must clear the full safe ground lane.
      for (const x of [-4, -2, 0, 2, 4]) {
        const ray = new Raycaster(new Vector3(x, 1, 15), new Vector3(0, 0, -1), 0, 30);
        expect(ray.intersectObjects(structure, false)).toHaveLength(0);
      }
    }
    const bounds = new Box3();
    gate.forEach(mesh => bounds.expandByObject(mesh));
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.max.y).toBeGreaterThan(16);
  });
});
