import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import type { TrackData } from "../track/trackData";

/** Continuous overlapping ridgelines leave the coastal horizon open to the south. */
export function worldRidgeGeometry(track: TrackData, heights: number, palette: readonly string[]) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let layer = 0; layer < palette.length; layer++) {
    const tint = new Color(palette[layer]), start = positions.length / 3;
    for (let i = 0; i <= 36; i++) {
      const x = track.bounds.centerX + (i - 18) * 48;
      const z = track.bounds.centerZ + track.bounds.depth / 2 + 500 + layer * 120;
      const height = (heights + layer * 28 + Math.sin(i * .47 + layer) * 30 + Math.cos(i * 1.1) * 12) * Math.sin(i / 36 * Math.PI);
      for (const [y, dz] of [[-3, -95], [height, 0], [-3, 100]]) {
        positions.push(x, y, z + dz); tint.toArray(colors, colors.length);
      }
      if (i < 36) for (let row = 0; row < 2; row++) {
        const a = start + i * 3 + row;
        indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}
