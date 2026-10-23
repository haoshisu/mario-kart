import { TRACK_CATALOG, type TrackId } from "./trackCatalog";
import { createTrackSamples } from "./trackPath";

export type TrackPreview = Readonly<{ path: string; viewBox: string }>;
const previews = new Map<TrackId, TrackPreview>();

// Selection needs only the authored centreline, not road meshes, collision or item placement.
export function getTrackPreview(id: TrackId): TrackPreview {
  const cached = previews.get(id);
  if (cached) return cached;
  const definition = TRACK_CATALOG[id];
  const samples = createTrackSamples(definition.curves, definition.elevation);
  const xs = samples.map(sample => sample.position[0]), zs = samples.map(sample => sample.position[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  // Native SVG cubics retain the exact authored shape with far fewer coordinates than a polyline.
  const path = `M${definition.curves[0][0].join(",")}` + definition.curves.map(([, b, c, d]) =>
    `C${b.join(",")} ${c.join(",")} ${d.join(",")}`).join("") + "Z";
  const preview = { path, viewBox: `${minX - 9} ${minZ - 9} ${maxX - minX + 18} ${maxZ - minZ + 18}` };
  previews.set(id, preview);
  return preview;
}
