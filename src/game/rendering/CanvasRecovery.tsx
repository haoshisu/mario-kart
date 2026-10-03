import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export function CanvasRecovery() {
  const renderer = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = renderer.domElement;
    const notice = document.createElement("div");
    notice.className = "scene-notice canvas-recovery";
    notice.setAttribute("role", "alert");
    const message = document.createElement("p");
    message.textContent = "3D 顯示暫時中斷，正在等待顯示卡恢復。比賽可能仍在進行；若未恢復，請重新載入。";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "重新載入遊戲";
    const reload = () => window.location.reload();
    button.addEventListener("click", reload);
    notice.append(message, button);
    const lost = (event: Event) => {
      event.preventDefault();
      window.dispatchEvent(new Event("blur"));
      canvas.parentElement?.append(notice);
    };
    const restored = () => notice.remove();
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      button.removeEventListener("click", reload);
      notice.remove();
    };
  }, [renderer]);
  return null;
}
