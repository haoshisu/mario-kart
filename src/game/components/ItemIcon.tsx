import type { ItemKind } from "../core/items/itemConfig";

export const ITEM_COLORS: Record<ItemKind, string> = {
  boost: "#ffe16a", shield: "#60e4ff", trap: "#ed94ff", disc: "#ffab63", orb: "#9cfff0", comet: "#ff6b8b",
};
/** Original silhouettes stay readable without relying on colour or text alone. */
export function ItemIcon({ kind }: { kind: ItemKind | null }) {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="item-icon" fill="none" stroke={kind ? ITEM_COLORS[kind] : "#8dabb4"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    {kind === "boost" ? <path fill={ITEM_COLORS.boost} stroke="#fff9d8" d="M27 4 10 27h12l-2 17 18-26H25z" /> : null}
    {kind === "shield" ? <><path fill="#216e8b" d="m24 4 16 7-2 17c-2 8-14 16-14 16S12 36 10 28L8 11z" /><path d="m16 23 6 6 12-13" /></> : null}
    {kind === "trap" ? <><ellipse cx="24" cy="32" rx="19" ry="9" /><path d="m24 6 10 17-10 11-10-11zM8 8l4 5m28-5-4 5" fill="#8845a8" /></> : null}
    {kind === "disc" ? <><ellipse cx="24" cy="25" rx="20" ry="10" fill="#a85025" /><ellipse cx="24" cy="23" rx="10" ry="5" /><path d="M7 10h14M3 16h9m24 19h9" /></> : null}
    {kind === "orb" ? <><circle cx="26" cy="23" r="12" fill="#207c84" /><path d="m12 9 4 5M3 24h10M8 37l8-7m17-13 4-2" /><circle cx="26" cy="23" r="4" fill="#d9fff9" /></> : null}
    {kind === "comet" ? <><path d="M6 6l16 16M14 4l12 12M4 14l12 12" /><path fill="#b22a4d" stroke="#fff0f3" d="m33 17 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z" /></> : null}
    {!kind ? <path strokeDasharray="3 5" d="M12 8h24l4 4v24l-4 4H12l-4-4V12z" /> : null}
  </svg>;
}
