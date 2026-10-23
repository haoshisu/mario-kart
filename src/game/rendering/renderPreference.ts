export type RenderQuality = "standard" | "low";
export const RENDER_QUALITY_KEY = "kart-lab:render-quality:v1";
export type RenderPreference = Readonly<{ quality: RenderQuality; ready: boolean; unavailable: boolean }>;

export function parseRenderQuality(value: unknown): RenderQuality | null {
  return value === "standard" || value === "low" ? value : null;
}

export function createRenderPreference(initialQuality: RenderQuality, storage: () => Pick<Storage, "getItem" | "setItem">) {
  const initial: RenderPreference = { quality: initialQuality, ready: false, unavailable: false };
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const publish = (next: RenderPreference) => {
    snapshot = next;
    listeners.forEach(notify => notify());
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe(notify: () => void) { listeners.add(notify); return () => { listeners.delete(notify); }; },
    load() {
      if (snapshot.ready) return;
      let quality = initialQuality, unavailable = false;
      try { quality = parseRenderQuality(storage().getItem(RENDER_QUALITY_KEY)) ?? initialQuality; }
      catch { unavailable = true; }
      publish({ quality, ready: true, unavailable });
    },
    select(quality: RenderQuality) {
      let unavailable = false;
      try { storage().setItem(RENDER_QUALITY_KEY, quality); } catch { unavailable = true; }
      publish({ quality, ready: true, unavailable });
    },
  };
}
