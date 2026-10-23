import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Box3, Mesh, type Material } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

describe("original GLB assets", () => {
  for (const [name, maxBytes, maxTriangles] of [
    ["pulse-kart-v1", 1_048_576, 12_000],
    ["pulse-wheel-v1", 131_072, 1_000],
    ["pulse-kart-v2", 1_048_576, 12_000],
    ["pulse-wheel-v2", 131_072, 1_000],
    ["kestrel-kart-v1", 1_048_576, 12_000],
    ["kestrel-kart-low-v1", 1_048_576, 8_000],
    ["kestrel-kart-v2", 1_048_576, 12_000],
    ["kestrel-kart-low-v2", 1_048_576, 8_000],
    ["kestrel-wheel-v1", 131_072, 1_000],
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
      const materials = new Set<Material>();
      gltf.scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
        expect(node.material).toBeDefined();
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
        expect(Array.from(node.geometry.attributes.normal.array).every(Number.isFinite)).toBe(true);
      });
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(maxTriangles);
      expect(materials.size).toBeLessThanOrEqual(name.includes("wheel") ? 3 : 12);
      const bounds = new Box3().setFromObject(gltf.scene);
      if (name.includes("wheel")) {
        expect(bounds.max.y).toBeCloseTo(0.29, 3);
        expect(bounds.min.y).toBeCloseTo(-0.29, 3);
      } else {
        expect(bounds.min.z).toBeGreaterThan(name.startsWith("kestrel") ? -1.35 : -1.1);
        expect(bounds.max.z).toBeLessThan(1.1);
        expect(gltf.animations.map((clip) => clip.name)).toContain("Victory1");
        if (name.startsWith("kestrel")) {
          const names = [...materials].map(material => material.name);
          expect(names).toContain("PlayerPaint");
          expect(names).toContain("DriverFabric");
          const mixer = new AnimationMixer(gltf.scene);
          const arms = [-1, 1].map(side => gltf.scene.getObjectByName(`AsterArm${side}`));
          const seatedHeights = arms.map(arm => {
            if (!arm) throw new Error("Kestrel victory arm is missing");
            return new Box3().setFromObject(arm).max.y;
          });
          gltf.animations.forEach(clip => mixer.clipAction(clip).play());
          mixer.update(.6);
          arms.forEach((arm, index) => {
            if (!arm) throw new Error("Kestrel victory arm is missing");
            expect(new Box3().setFromObject(arm).max.y).toBeGreaterThan(seatedHeights[index] + .25);
          });
          mixer.stopAllAction();
          arms.forEach((arm, index) => {
            if (!arm) throw new Error("Kestrel victory arm is missing");
            expect(new Box3().setFromObject(arm).max.y).toBeCloseTo(seatedHeights[index], 5);
          });
          mixer.uncacheRoot(gltf.scene);
        }
      }
    });
  }
});
