import { BoxGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry, type BufferGeometry } from "three";
import type { TrackData } from "../track/trackData";
import type { CityTrackId } from "../track/cityTracks";
import { distanceToTrack, pointAtTrackOffset } from "../track/trackPath";
import { surfaceOffsetHeight } from "../track/trackSurface";

/** Dress the pedestrian strip, checking every road so adjacent bends stay clear. */
export function gardenStreetDetails(track: TrackData, id: CityTrackId, low: boolean, add: (geometry: BufferGeometry, color: string) => void) {
  const roads = [track.samples, ...track.branches.map(b => b.samples)];
  const clear = (x: number, z: number, radius: number) => roads.every(road => distanceToTrack(x, z, road, { closed: road === track.samples }) > 4.8 + radius);
  for (const road of roads) road.forEach((s, i) => {
    if (i % 4) return;
    const yaw = Math.atan2(-s.tangent[0], -s.tangent[1]);
    for (const side of [-1, 1]) {
      const [x, z] = pointAtTrackOffset(s, side * 7.8), y = surfaceOffsetHeight(s, side * 7.8);
      if (!clear(x, z, 2.9)) continue;
      const box = (dx: number, dy: number, dz: number, w: number, h: number, d: number, color: string) => add(new BoxGeometry(w, h, d).translate(dx, dy, dz).rotateY(yaw).translate(x, y, z), color);
      // Continuous paving and retaining skirt connect raised shops to the deck.
      add(new PlaneGeometry(4, 4.1).rotateX(-Math.PI / 2).rotateY(yaw).translate(x, y - .05, z), id === "tainan" ? "#d6ba98" : "#c7cec0");
      if (y > 1) add(new PlaneGeometry(4.1, y).rotateY(side * Math.PI / 2).translate(side * 1.85, -y / 2, 0).rotateY(yaw).translate(x, y, z), "#9eaa98");
      if (low && Math.floor(i / 24) % 2) continue;
      if (i % 24 === 0) {
        box(side * 1.1, .35, 0, 1.5, .7, 2.4, "#a17d62");
        add(new SphereGeometry(1, 5, 4).scale(1, 1.6, 1.4).translate(x + Math.cos(yaw) * side * 1.1, y + 1.9, z - Math.sin(yaw) * side * 1.1), id === "tainan" ? "#78934c" : "#4f8b69");
        box(-side * .9, 2.1, 0, .12, 4.2, .12, "#58615b");
        box(-side * .9, 4.15, 0, .65, .25, .65, "#ffe1a0");
      } else if (i % 24 === 12) {
        box(0, .65, 0, 2.2, .18, .65, "#9c6e4b");
        box(0, 1.1, -.35, 2.2, .7, .13, "#a57c58");
        if (!low) for (const dx of [-.8, .8]) box(dx, .3, 0, .14, .6, .6, "#526960");
      }
      if (i % (low ? 192 : 48) === 8 && clear(x, z, 2.2)) {
        box(0, .8, 0, 2.6, 1.6, 1.3, "#b38058");
        box(0, 2.7, 0, 3.2, .18, 2.2, id === "tainan" ? "#d4784c" : "#619b8c");
        for (const dx of [-1.3, 1.3]) box(dx, 1.7, 0, .1, 2.2, .1, "#e6cba4");
        add(new CylinderGeometry(.45, .45, .7, 6).translate(x, y + 1.9, z), "#edc381");
      }
    }
  });
}
