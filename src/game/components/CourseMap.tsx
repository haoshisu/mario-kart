import { useEffect, useRef, type RefObject } from "react";
import { useTrack } from "../track/TrackContext";
import { PLAYER_COLOR_VALUES } from "../network/networkConfig";
import type { SnapshotBuffer } from "../network/interpolation";
import type { KartRuntimeState } from "../runtime/kartRuntime";
import styles from "./CourseMap.module.css";

/** DOM markers refresh at 10 Hz without rerendering the scene or HUD. */
export function CourseMap({ runtimeRef, snapshotsRef, playerId }: {
  runtimeRef?: RefObject<KartRuntimeState>;
  snapshotsRef?: RefObject<SnapshotBuffer>;
  playerId?: string;
}) {
  const track = useTrack();
  const { race: { FINISH_MARKER }, items: { BOOST_PADS } } = track;
  const OUTLINE = track.samples.map((sample, i) => `${i ? "L" : "M"}${sample.position[0]},${sample.position[1]}`).join(" ") + " Z";
  const markers = useRef<(SVGCircleElement | null)[]>([]);
  useEffect(() => {
    const update = () => {
      const snapshot = snapshotsRef?.current.sample();
      for (let i = 0; i < 4; i += 1) {
        const marker = markers.current[i];
        if (!marker) continue;
        const player = snapshot?.players[i];
        const solo = i === 0 ? runtimeRef?.current : undefined;
        marker.style.display = player || solo ? "" : "none";
        if (!player && !solo) continue;
        marker.setAttribute("cx", String(player ? player.position[0] : solo?.renderPosition.x));
        marker.setAttribute("cy", String(player ? player.position[2] : solo?.renderPosition.z));
        marker.setAttribute("fill", player ? PLAYER_COLOR_VALUES[player.color] : "#ffcf4e");
        marker.setAttribute("r", !player || player.id === playerId ? "2.4" : "1.7");
        marker.setAttribute("stroke-width", !player || player.id === playerId ? "1" : ".5");
      }
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [runtimeRef, snapshotsRef, playerId]);
  return <aside className={styles.map} aria-label={`${track.name}賽道地圖`} data-testid="course-map">
    <span>{track.name}<small>3 LAPS</small></span>
    <svg viewBox={track.bounds.viewBox} role="img" aria-label="路線、跳台、加速帶與車輛位置；白框大圓點為自己">
      <path d={OUTLINE} fill="none" stroke="#0c323d" strokeWidth="7" strokeLinejoin="round" />
      <path d={OUTLINE} fill="none" stroke="#eaf6e5" strokeWidth="4" strokeLinejoin="round" />
      {track.branches.map(branch => <path key={branch.id} data-testid={(branch.movable || branch.id === "taipei-crossing") ? "map-risk-route" : "map-shortcut"} d={branch.samples.map((sample, i) => `${i ? "L" : "M"}${sample.position[0]},${sample.position[1]}`).join(" ")} fill="none" stroke="#ffd37c" strokeWidth="3" />)}
      {BOOST_PADS.map((pad) => <circle key={pad.id} cx={pad.position[0]} cy={pad.position[1]} r="1.4" fill="#c9f84c" stroke="#587827" strokeWidth=".4" />)}
      {track.ramps.map(ramp => <rect key={ramp.id} x={ramp.position[0] - 1.5} y={ramp.position[1] - 1.5} width="3" height="3" fill="#ec70ef" stroke="#ffffff" strokeWidth=".5" />)}
      <path d={`M${FINISH_MARKER.position[0]},${FINISH_MARKER.position[1] - 3}v6`} stroke="#f8796b" strokeWidth="1.2" />
      {Array.from({ length: 4 }, (_, i) => <circle key={i} ref={(node) => { markers.current[i] = node; }} r="2" stroke="white" style={{ display: "none" }} />)}
    </svg>
  </aside>;
}
