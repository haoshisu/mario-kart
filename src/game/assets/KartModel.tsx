import { characterModelUrl, type CharacterId } from "../entities/characters";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { AnimationMixer, Mesh, MeshStandardMaterial, type Group } from "three";
import { createWheelVisualDynamics, stepWheelVisualDynamics } from "./kartVisualDynamics";
import { KART_CONFIG } from "../core/kart/kartConfig";
import { useRenderQuality } from "../rendering/RenderSettings";

export type KartVisualMotion = { speed: number; steer: number; finished?: boolean };
const WHEEL_URL = "/models/kestrel-wheel-v1.glb";

export function KartBodyModel({ color, characterId, motionRef }: {
  color: string;
  characterId: CharacterId;
  motionRef: RefObject<KartVisualMotion>;
}) {
  const quality = useRenderQuality();
  const { scene, animations } = useGLTF(characterModelUrl(characterId, quality === "low"), "/draco/");
  const model = useMemo(() => {
    const root = scene.clone(true);
    const paint = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.material instanceof MeshStandardMaterial && object.material.name === "PlayerPaint") {
        const source = object.material;
        let material = paint.get(source);
        if (!material) {
          material = source.clone();
          material.color.set(color);
          paint.set(source, material);
        }
        object.material = material;
      }
    });
    return { root, materials: [...paint.values()] };
  }, [scene, color]);
  const mixer = useMemo(() => new AnimationMixer(model.root), [model]);
  const playing = useRef(false);
  useEffect(() => {
    playing.current = false;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model.root);
      model.materials.forEach((material) => material.dispose());
    };
  }, [model, mixer]);
  useFrame((_, delta) => {
    const finished = motionRef.current.finished === true;
    if (finished !== playing.current) {
      playing.current = finished;
      if (finished) animations.forEach((clip) => mixer.clipAction(clip).reset().play());
      else mixer.stopAllAction();
    }
    mixer.update(Math.min(delta, 0.1));
  });
  return <primitive object={model.root} dispose={null} />;
}

export function KartWheelModel({ position, motionRef }: {
  position: [number, number, number];
  motionRef: RefObject<KartVisualMotion>;
}) {
  const { scene } = useGLTF(WHEEL_URL, "/draco/");
  const root = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => { if (object instanceof Mesh) object.castShadow = true; });
    return copy;
  }, [scene]);
  const steerRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const dynamics = useRef(createWheelVisualDynamics());
  useFrame((_, delta) => {
    stepWheelVisualDynamics(dynamics.current, motionRef.current.speed, motionRef.current.steer,
      KART_CONFIG.wheels.radius * KART_CONFIG.modelScale, delta);
    if (spinRef.current) spinRef.current.rotation.x = dynamics.current.spin;
    if (steerRef.current && position[2] < 0) steerRef.current.rotation.y = dynamics.current.steering;
  });
  return <group position={position} ref={steerRef}>
    <mesh position={[0, -.288, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[.74, .74]} />
      <shaderMaterial transparent depthWrite={false}
        vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        fragmentShader="varying vec2 vUv; void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(0.0,0.0,0.0,.22*(1.0-smoothstep(.15,1.0,r)));}" />
    </mesh>
    <group ref={spinRef}><primitive object={root} dispose={null} /></group></group>;
}
