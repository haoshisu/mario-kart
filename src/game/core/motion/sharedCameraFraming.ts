import { NETWORK_CONFIG } from "../../network/networkConfig";

type FramingPlayer = { position: readonly number[]; status: string };
export type SharedCameraFrame = { x: number; z: number; distance: number; initialized: boolean };

export function updateSharedCameraFrame(
  frame: SharedCameraFrame,
  players: readonly FramingPlayer[],
  verticalFov: number,
  aspect: number,
  delta: number,
) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const player of players) {
    if (player.status === "dnf") continue;
    minX = Math.min(minX, player.position[0]);
    maxX = Math.max(maxX, player.position[0]);
    minZ = Math.min(minZ, player.position[2]);
    maxZ = Math.max(maxZ, player.position[2]);
  }
  if (!Number.isFinite(minX)) return false;
  const settings = NETWORK_CONFIG.sharedCamera;
  const smoothing = 1 - Math.exp(-settings.followFrequency * Math.min(delta, 0.1));
  const amount = frame.initialized ? smoothing : 1;
  frame.x += ((minX + maxX) / 2 - frame.x) * amount;
  frame.z += ((minZ + maxZ) / 2 - frame.z) * amount;
  let radius = 0;
  for (const player of players) {
    if (player.status === "dnf") continue;
    radius = Math.max(radius, Math.hypot(player.position[0] - frame.x, player.position[2] - frame.z));
  }
  const verticalHalfAngle = verticalFov * Math.PI / 360;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * aspect);
  // Fit a padded sphere inside both frustum dimensions, including during target smoothing.
  const required = Math.max(settings.minimumDistance,
    (radius + settings.framingPadding) / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle)));
  // Zoom out immediately to preserve visibility; ease back in when players regroup.
  frame.distance = !frame.initialized || required > frame.distance
    ? required : frame.distance + (required - frame.distance) * smoothing;
  frame.initialized = true;
  return true;
}
