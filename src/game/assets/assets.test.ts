import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

describe("original GLB assets", () => {
  for (const [name, maxBytes, maxTriangles] of [
    ["pulse-kart-v1", 1_048_576, 12_000],
    ["pulse-wheel-v1", 131_072, 1_000],
  ] as const) {
    it(`${name} parses with embedded resources and stays within budget`, async () => {
      const bytes = readFileSync(`public/models/${name}.glb`);
      expect(bytes.length).toBeLessThanOrEqual(maxBytes);
      expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      expect(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()).toContain("KHR_draco_mesh_compression");
      // Browsers exercise the actual local WASM decoder. Parse the matching
      // uncompressed Blender export here because Node has no Web Worker API.
      const source = readFileSync(`art-source/${name}.glb`);
      expect(bytes.length).toBeLessThan(source.length);
      const gltf = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "");
      let triangles = 0;
      gltf.scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
        expect(node.material).toBeDefined();
      });
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(maxTriangles);
      const bounds = new Box3().setFromObject(gltf.scene);
      if (name === "pulse-wheel-v1") {
        expect(bounds.max.y).toBeCloseTo(0.29, 3);
        expect(bounds.min.y).toBeCloseTo(-0.29, 3);
      } else {
        expect(bounds.min.z).toBeGreaterThan(-1.1);
        expect(bounds.max.z).toBeLessThan(1.1);
        expect(gltf.animations.map((clip) => clip.name)).toContain("Victory1");
      }
    });
  }
});
