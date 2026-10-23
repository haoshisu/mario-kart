import { Environment, Lightformer } from "@react-three/drei";

/** Local light cards reveal paint curvature without a remote HDR download. */
export function SceneReflections() {
  return <Environment frames={1} resolution={128} environmentIntensity={.45}>
    <color attach="background" args={["#5c6773"]} />
    <Lightformer position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 12, 1]} intensity={2.5} />
    <Lightformer position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[5, 3, 1]} intensity={2} color="#d2e1f0" />
    <Lightformer position={[5, 3, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 5, 1]} intensity={1.5} color="#ffe6ce" />
  </Environment>;
}
