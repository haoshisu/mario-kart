"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createRenderPreference, type RenderQuality as Quality } from "./renderPreference";

const RenderQuality = createContext<Quality>("standard");
export const useRenderQuality = () => useContext(RenderQuality);

export function RenderSettings({ children, initialQuality = "standard" }: { children: (quality: Quality) => ReactNode; initialQuality?: Quality }) {
  const [preference] = useState(() => createRenderPreference(initialQuality, () => localStorage));
  const { quality, ready, unavailable } = useSyncExternalStore(preference.subscribe, preference.getSnapshot, preference.getServerSnapshot);
  useEffect(() => { preference.load(); }, [preference]);
  return <RenderQuality.Provider value={quality}>
    {ready ? children(quality) : <div className="scene-notice render-settings-loading" role="status">套用顯示設定…</div>}
    <label className="render-settings">畫質
      <select aria-label="畫質" disabled={!ready} value={quality} onChange={(event) => preference.select(event.target.value === "low" ? "low" : "standard")}>
        <option value="standard">標準</option><option value="low">省電（關閉陰影）</option>
      </select>
      {unavailable ? <small className="render-settings-warning" role="status">無法儲存畫質，僅本次有效</small> : null}
    </label>
  </RenderQuality.Provider>;
}
