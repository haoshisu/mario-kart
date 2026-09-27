export type TrackConfig = Readonly<{
 straightLength: number
 turnRadius: number
 roadWidth: number
 roadTop: number
 roadThickness: number
 curbWidth: number
 curbHeight: number
 straightSegments: number
 curveSegments: number
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
 straightLength: 28,
 turnRadius: 10.5,
 roadWidth: 6.4,
 roadTop: 0.08,
 roadThickness: 0.08,
 curbWidth: 0.7,
 curbHeight: 0.07,
 straightSegments: 28,
 curveSegments: 36,
 guardRail: {
  gap: 0.5,
  height: 0.92,
  thickness: 0.28,
 },
 ground: {
  width: 68,
  depth: 52,
  thickness: 0.4,
 },
} as const satisfies TrackConfig

export const TRACK_COLORS = {
 asphalt: "#30363a",
 curbRed: "#db3b37",
 curbWhite: "#f2ead8",
 grass: "#527a3b",
 railRed: "#c93331",
 railWhite: "#e8e2d3",
} as const
