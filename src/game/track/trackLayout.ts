export type TrackPoint = readonly [x: number, z: number];
export type TrackCurve = readonly [TrackPoint, TrackPoint, TrackPoint, TrackPoint];

/** Original amusement-park figure eight. The two central diagonals cross
 * in plan only: the outbound bridge is thirteen metres above the valley. */
export const TRACK_CURVES: readonly TrackCurve[] = [
  [[-14,-10.5],[-4,-10.5],[4,-10.5],[14,-10.5]],
  [[14,-10.5],[28.688,-10.5],[65.184,-10.5],[65.184,9.492]],
  [[65.184,9.492],[65.184,22.548],[52.352,29.892],[42.56,37.236]],
  [[42.56,37.236],[16.448,56.82],[-16.448,78.036],[-42.56,97.62]],
  [[-42.56,97.62],[-54.8,106.8],[-59.696,103.74],[-59.696,117.492]],
  [[-59.696,117.492],[-59.696,130.708],[-33.584,136.164],[-12,136.164]],
  [[-12,136.164],[15.632,136.164],[59.696,134.58],[59.696,117.492]],
  [[59.696,117.492],[59.696,104.412],[53.984,106.188],[42.56,97.62]],
  [[42.56,97.62],[16.448,78.036],[-16.448,56.82],[-42.56,37.236]],
  [[-42.56,37.236],[-54.8,28.056],[-82.36,19.284],[-82.36,6.228]],
  [[-82.36,6.228],[-82.36,-10.5],[-36.848,-10.5],[-22.16,-10.5]],
  [[-22.16,-10.5],[-19.712,-10.5],[-16.448,-10.5],[-14,-10.5]],
];

export const TRACK_LAYOUT = {
  name: "風車花谷",
  subtitle: "WINDMILL VALLEY",
  sampleSpacing: 1,
  finish: [-7, -10.5] as TrackPoint,
  spawn: [-10, -10.5] as TrackPoint,
  spawnYaw: -Math.PI / 2,
} as const;
