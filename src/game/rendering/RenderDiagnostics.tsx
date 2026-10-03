import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// Diagnostics are opt-in and update a DOM output once a second, not React state
// on every frame. Counts describe WebGL resources, not unavailable GPU bytes.
export function RenderDiagnostics() {
  const renderer = useThree((state) => state.gl);
  const elapsed = useRef(0);
  const samples = useRef<number[]>([]);
  const output = useRef<HTMLOutputElement | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("stats") !== "1") return;
    const node = document.createElement("output");
    node.className = "render-diagnostics";
    node.dataset.testid = "render-diagnostics";
    renderer.domElement.parentElement?.append(node);
    output.current = node;
    return () => { node.remove(); output.current = null; };
  }, [renderer]);
  useFrame((_, delta) => {
    if (!output.current) return;
    elapsed.current += delta;
    samples.current.push(delta * 1000);
    if (elapsed.current < 1) return;
    const frames = samples.current;
    frames.sort((a, b) => a - b);
    const fps = frames.length / elapsed.current;
    const p95 = frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.95))];
    const info = renderer.info;
    output.current.textContent = `${fps.toFixed(0)} FPS · p95 ${p95.toFixed(1)} ms · ${info.render.calls} calls · ${info.render.triangles} triangles · ${info.memory.geometries} geometries / ${info.memory.textures} textures`;
    output.current.dataset.fps = fps.toFixed(1);
    output.current.dataset.calls = String(info.render.calls);
    output.current.dataset.triangles = String(info.render.triangles);
    frames.length = 0;
    elapsed.current = 0;
  });
  return null;
}
