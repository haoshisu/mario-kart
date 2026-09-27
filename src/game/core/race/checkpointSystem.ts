import type { Point2, RaceMarker } from "./raceTrack";

export type CrossingDirection = "forward" | "reverse" | null;

function signedForwardDistance(marker: RaceMarker, point: Point2) {
  return (
    (point[0] - marker.position[0]) * marker.forward[0] +
    (point[1] - marker.position[1]) * marker.forward[1]
  );
}

export function getMarkerCrossingDirection(
  marker: RaceMarker,
  previous: Point2,
  current: Point2,
): CrossingDirection {
  const previousDistance = signedForwardDistance(marker, previous);
  const currentDistance = signedForwardDistance(marker, current);
  const crossedForward = previousDistance <= 0 && currentDistance > 0;
  const crossedReverse = previousDistance >= 0 && currentDistance < 0;

  if (!crossedForward && !crossedReverse) {
    return null;
  }

  const denominator = previousDistance - currentDistance;
  if (Math.abs(denominator) < Number.EPSILON) {
    return null;
  }

  const interpolation = previousDistance / denominator;
  const crossingX = previous[0] + (current[0] - previous[0]) * interpolation;
  const crossingZ = previous[1] + (current[1] - previous[1]) * interpolation;
  const lateralDistance = Math.abs(
    (crossingX - marker.position[0]) * marker.right[0] +
    (crossingZ - marker.position[1]) * marker.right[1],
  );

  if (lateralDistance > marker.halfWidth) {
    return null;
  }

  return crossedForward ? "forward" : "reverse";
}

export function createMarkerCrossingSegment(marker: RaceMarker, direction: "forward" | "reverse") {
  const sign = direction === "forward" ? 1 : -1;
  const distance = marker.halfDepth + 0.2;
  return {
    previous: [
      marker.position[0] - marker.forward[0] * distance * sign,
      marker.position[1] - marker.forward[1] * distance * sign,
    ] as const,
    current: [
      marker.position[0] + marker.forward[0] * distance * sign,
      marker.position[1] + marker.forward[1] * distance * sign,
    ] as const,
  };
}
