export type TrackConfig = Readonly<{
 roadWidth: number
 roadTop: number
 roadThickness: number
 curbWidth: number
 curbHeight: number
 guardRail: Readonly<{
  gap: number
  height: number
  thickness: number
 }>
 ground: Readonly<{
  width: number
  depth: number
  thickness: number
 }>
}>

/**
 * The track mesh, static colliders, and camera framing all derive from these
 * values. Changing a dimension here therefore cannot leave physics behind.
 */
export const TRACK_CONFIG = {
 roadWidth: 8.4,
 roadTop: 0.08,
 roadThickness: 0.65,
 curbWidth: 0.7,
 curbHeight: 0.07,
 guardRail: {
  gap: 0.5,
  height: 0.92,
  thickness: 0.28,
 },
 ground: {
  width: 150,
  depth: 130,
  thickness: 0.4,
 },
} as const satisfies TrackConfig

export const TRACK_COLORS = {
 asphalt: "#65758b",
 curbRed: "#db3b37",
 curbWhite: "#f2ead8",
 grass: "#79c744",
 railRed: "#179dae",
 railWhite: "#e8e2d3",
} as const
