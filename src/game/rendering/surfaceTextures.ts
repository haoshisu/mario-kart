import { DataTexture, RepeatWrapping, RGBAFormat, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter } from "three";

export type SurfaceKind = "asphalt" | "concrete" | "brick" | "wood" | "metal" | "water" | "grass";
const textures = new Map<SurfaceKind, DataTexture>();
/** Small deterministic material maps stay shared across rooms and scene remounts. */
export function surfaceTexture(kind: SurfaceKind) {
  const cached = textures.get(kind);
  if (cached) return cached;
  const size = 256, bytes = new Uint8Array(size * size * 4);
  let seed = 173;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = random(), row = Math.floor(y / 32);
    const mortar = y % 32 < 2 || (x + (row % 2) * 32) % 64 < 2;
    const wood = Math.sin(x * .21 + Math.sin(y * .045) * 3) * 12;
    const value = kind === "water" ? 192 + Math.sin(x*.13+Math.sin(y*.07)*3)*24 + Math.sin(y*.19)*12
      : kind === "grass" ? 168 + grain*53 + Math.sin(x*.35+y*.13)*18
      : kind === "brick" ? mortar ? 120 + grain * 18 : 197 + grain * 40 + Math.sin(Math.floor(x / 64) * 3 + row) * 12
      : kind === "wood" ? 194 + wood + grain * 26
      : kind === "metal" ? 214 + grain * 10 + Math.sin(y * 3) * 5
      : kind === "asphalt" ? 168 + grain * 62 + (grain > .95 ? 15 : 0)
      : 211 + grain * 30 + Math.sin(x * .07) * Math.sin(y * .09) * 5;
    const index = (y * size + x) * 4;
    bytes[index] = bytes[index + 1] = bytes[index + 2] = value; bytes[index + 3] = 255;
  }
  const texture = new DataTexture(bytes, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  if (kind === "brick") texture.repeat.set(3, 2);
  texture.needsUpdate = true;
  textures.set(kind, texture);
  return texture;
}
