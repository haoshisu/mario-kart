"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Quality = "standard" | "low";
const RenderQuality = createContext<Quality>("standard");
export const useRenderQuality = () => useContext(RenderQuality);

export function RenderSettings({ children, initialQuality = "standard" }: { children: (quality: Quality) => ReactNode; initialQuality?: Quality }) {
  const [quality, setQuality] = useState<Quality>(initialQuality);
  return <RenderQuality.Provider value={quality}>
    {children(quality)}
    <label className="render-settings">畫質
      <select value={quality} onChange={(event) => setQuality(event.target.value === "low" ? "low" : "standard")}>
        <option value="standard">標準</option><option value="low">省電（關閉陰影）</option>
      </select>
    </label>
  </RenderQuality.Provider>;
}
