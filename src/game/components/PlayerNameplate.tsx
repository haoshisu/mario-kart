import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3, type Group } from "three";

export function PlayerNameplate({ nickname }: { nickname: string }) {
  const anchor = useRef<Group>(null);
  const label = useRef<HTMLDivElement | null>(null);
  const projected = useRef(new Vector3());
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => {
    const target = canvas.parentElement;
    if (!target) return;
    // This static label needs no second React root. Its owner can safely remove
    // it during scene cleanup, including Strict Mode and Suspense remounts.
    const element = document.createElement("div");
    element.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:2;display:none";
    const text = document.createElement("span");
    text.className = "player-nameplate";
    text.textContent = nickname;
    element.appendChild(text);
    target.appendChild(element);
    label.current = element;
    return () => {
      label.current = null;
      element.remove();
    };
  }, [canvas, nickname]);

  useFrame(({ camera, size }) => {
    const element = label.current;
    const group = anchor.current;
    if (!element || !group) return;
    group.getWorldPosition(projected.current);
    projected.current.project(camera);
    const { x, y, z } = projected.current;
    const visible = z >= -1 && z <= 1 && Math.abs(x) <= 1 && Math.abs(y) <= 1;
    element.style.display = visible ? "block" : "none";
    if (visible) {
      element.style.transform = `translate3d(${(x + 1) * size.width / 2}px,${(1 - y) * size.height / 2}px,0) translate(-50%,-50%)`;
    }
  });

  return <group ref={anchor} position={[0, 1.45, 0]} />;
}
