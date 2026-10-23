import { performance } from "node:perf_hooks";
import { TRACK_IDS } from "../src/game/track/trackCatalog";

// Run each mode in a fresh process; this isolates both module and per-course caches.
async function main() {
const mode = process.argv[2];
if (mode !== "before" && mode !== "after") throw new Error("Expected before or after");
const importStart = performance.now();
const load = mode === "before" ? await import("../src/game/track/trackData").then(({ getTrackData }) => (id: typeof TRACK_IDS[number]) => {
  const track = getTrackData(id);
  return { path: track.samples.map((sample, index) => `${index ? "L" : "M"}${sample.position.join(",")}`).join(" ") + "Z", viewBox: track.bounds.viewBox };
}) : (await import("../src/game/track/trackPreview")).getTrackPreview;
const importMs = performance.now() - importStart;
const heapBefore = process.memoryUsage().heapUsed;
const start = performance.now();
const previews = TRACK_IDS.map(load);
const coldMs = performance.now() - start;
const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
const repeats = 100;
const warmStart = performance.now();
for (let run = 0; run < repeats; run++) TRACK_IDS.forEach(load);
console.log(JSON.stringify({ mode, tracks: TRACK_IDS.length, importMs, coldMs, warm100Ms: performance.now() - warmStart,
  pathCharacters: previews.reduce((total, preview) => total + preview.path.length, 0), heapDeltaBytes,
  note: "Node microbenchmark; heap delta includes GC noise, not GPU memory or browser load time" }));

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
