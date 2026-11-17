import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRACK_CATALOG, TRACK_IDS, PLAYABLE_TRACK_IDS } from "./trackCatalog";
import { createTrackSamples } from "./trackPath";
import { getTrackPreview } from "./trackPreview";
import { TrackPicker } from "../components/TrackPicker";

vi.mock("./trackData", () => ({ getTrackData: () => { throw new Error("Preview must not construct complete track data"); } }));

it("renders all selection cards without building gameplay geometry", () => {
  const markup = renderToStaticMarkup(createElement(TrackPicker, { value: "taipei", onChange: () => {} }));
  // Only the city series is offered.
  expect(markup.match(/<svg /g)).toHaveLength(PLAYABLE_TRACK_IDS.length);
  expect(markup).not.toContain("風車花谷");
  expect(markup).toContain("府城暖巷");
  expect(markup).toContain("aria-pressed=\"true\"");
});
it.each(TRACK_IDS)("%s preview preserves bounds and caches compact native curves", id => {
  const preview = getTrackPreview(id);
  const definition = TRACK_CATALOG[id];
  const samples = createTrackSamples(definition.curves, definition.elevation);
  const [x, z, width, height] = preview.viewBox.split(" ").map(Number);
  expect([x, z, width, height].every(Number.isFinite)).toBe(true);
  expect(width).toBeGreaterThan(0); expect(height).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(sample.position[0]).toBeGreaterThanOrEqual(x + 8);
    expect(sample.position[0]).toBeLessThanOrEqual(x + width - 8);
    expect(sample.position[1]).toBeGreaterThanOrEqual(z + 8);
    expect(sample.position[1]).toBeLessThanOrEqual(z + height - 8);
  }
  expect(preview.path.match(/C/g)).toHaveLength(definition.curves.length);
  expect(preview.path.endsWith("Z")).toBe(true);
  expect(getTrackPreview(id)).toBe(preview);
  const oldPath = samples.map((sample, index) => `${index ? "L" : "M"}${sample.position.join(",")}`).join(" ") + "Z";
  expect(preview.path.length).toBeLessThan(oldPath.length / 5);
});
