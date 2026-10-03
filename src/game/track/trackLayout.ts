export type TrackPoint = readonly [x: number, z: number];
export type TrackCurve = readonly [TrackPoint, TrackPoint, TrackPoint, TrackPoint];

/** Tangent-continuous original circuit: launch straight, orchard sweeper,
 * alternating windmill esses, then a long return bend for charged drifts. */
export const TRACK_CURVES: readonly TrackCurve[] = [
  [[-14, -10.5], [-4, -10.5], [4, -10.5], [14, -10.5]],
  [[14, -10.5], [29, -10.5], [43, -10.5], [43, 4]],
  [[43, 4], [43, 18], [33, 26], [23, 26]],
  [[23, 26], [12, 26], [14, 10], [3, 10]],
  [[3, 10], [-8, 10], [-4, 32], [-17, 32]],
  [[-17, 32], [-33, 32], [-44, 25], [-44, 11]],
  [[-44, 11], [-44, -3], [-36, -10.5], [-24, -10.5]],
  [[-24, -10.5], [-21, -10.5], [-17, -10.5], [-14, -10.5]],
];

export const TRACK_LAYOUT = {
  name: "風車花谷",
  subtitle: "WINDMILL VALLEY",
  sampleSpacing: 1,
  finish: [-7, -10.5] as TrackPoint,
  spawn: [-10, -10.5] as TrackPoint,
  spawnYaw: -Math.PI / 2,
} as const;
