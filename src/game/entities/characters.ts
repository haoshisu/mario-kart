/** Shared identity only; selecting a character never changes kart physics. */
export const CHARACTER_IDS = ["dodo", "lumi", "lili", "bibo"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export const DEFAULT_CHARACTER: CharacterId = "dodo";
export const CHARACTERS: Readonly<Record<CharacterId, { name: string; description: string; accent: string }>> = {
  dodo: { name: "豆豆", description: "護目鏡小車手", accent: "#25b8a7" },
  lumi: { name: "露米", description: "雙丸子頭車手", accent: "#b298ee" },
  lili: { name: "栗栗", description: "大耳朵狐狸", accent: "#f1ac58" },
  bibo: { name: "嗶波", description: "圓頭機器人", accent: "#62bdf4" },
};
export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === "string" && CHARACTER_IDS.some(id => id === value);
}
export function characterModelUrl(id: CharacterId, low: boolean) {
  return `/models/chibi-${id}${low ? "-low" : ""}-v1.glb`;
}
