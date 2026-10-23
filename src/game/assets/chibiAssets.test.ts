import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnimationMixer, Box3, Mesh, type Material } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CHARACTER_IDS, characterModelUrl } from "../entities/characters";

describe("playable chibi crew", () => {
  for (const id of CHARACTER_IDS) for (const low of [false, true]) {
    it(`${id} ${low ? "low" : "standard"} fits the kart budget and restores its seated pose`, async () => {
      const url = characterModelUrl(id, low);
      const bytes = readFileSync(`public${url}`);
      expect(bytes.length).toBeLessThan(1_048_576);
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      expect(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()).toContain("KHR_draco_mesh_compression");
      const source = readFileSync(`art-source/chibi-karts/${url.split("/").at(-1)}`);
      const gltf = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "");
      const materials = new Set<Material>();
      let triangles = 0;
      gltf.scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m));
        expect(Array.from(node.geometry.attributes.normal.array).every(Number.isFinite)).toBe(true);
      });
      expect(triangles).toBeLessThanOrEqual(low ? 8_000 : 12_000);
      expect(materials.size).toBeLessThanOrEqual(12);
      expect([...materials].map(m => m.name)).toContain("PlayerPaint");
      expect([...materials].map(m => m.name)).toContain("CharacterSuit");
      const bounds = new Box3().setFromObject(gltf.scene);
      expect(bounds.max.y).toBeGreaterThan(1.1);
      expect(bounds.max.y).toBeLessThan(1.4);
      expect(bounds.min.z).toBeGreaterThan(-1.35);
      expect(bounds.max.z).toBeLessThan(1.1);
      const arms = [-1, 1].map(side => {
        const arm = gltf.scene.getObjectByName(`ChibiArm${side}`);
        if (!arm) throw new Error("Missing animated arm");
        return arm;
      });
      const seated = arms.map(arm => new Box3().setFromObject(arm).max.y);
      const mixer = new AnimationMixer(gltf.scene);
      expect(gltf.animations.map(clip => clip.name)).toContain("Victory1");
      gltf.animations.forEach(clip => mixer.clipAction(clip).play());
      mixer.update(.6);
      arms.forEach((arm, i) => expect(new Box3().setFromObject(arm).max.y).toBeGreaterThan(seated[i] + .25));
      mixer.stopAllAction();
      arms.forEach((arm, i) => expect(new Box3().setFromObject(arm).max.y).toBeCloseTo(seated[i], 5));
      mixer.uncacheRoot(gltf.scene);
    });
  }
});
