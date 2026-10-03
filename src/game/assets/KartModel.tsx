import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { AnimationMixer, Mesh, MeshStandardMaterial, type Group } from "three";
import { KART_CONFIG } from "../core/kart/kartConfig";

export type KartVisualMotion = { speed: number; steer: number; finished?: boolean };
const BODY_URL = "/models/pulse-kart-v1.glb";
const WHEEL_URL = "/models/pulse-wheel-v1.glb";

export function KartBodyModel({ color, motionRef }: {
  color: string;
  motionRef: RefObject<KartVisualMotion>;
}) {
  const { scene, animations } = useGLTF(BODY_URL, "/draco/");
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
  useEffect(() => () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model.root);
    model.materials.forEach((material) => material.dispose());
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
  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.x = (spinRef.current.rotation.x - motionRef.current.speed * Math.min(delta, 0.1) / KART_CONFIG.wheels.radius) % (Math.PI * 2);
    if (steerRef.current && position[2] < 0) steerRef.current.rotation.y = -motionRef.current.steer * 0.35;
  });
  return <group position={position} ref={steerRef}><group ref={spinRef}><primitive object={root} dispose={null} /></group></group>;
}
