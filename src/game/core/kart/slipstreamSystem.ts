export const SLIPSTREAM_CONFIG = {
  minimumSpeed: 8,
  minimumGap: 3,
  maximumGap: 10,
  halfWidth: 1.2,
  exitHalfWidth: 3.5,
  exitMinimumGap: 1,
  heightTolerance: 1.5,
  maximumHeadingDifference: Math.PI / 9,
  maximumExitHeadingDifference: Math.PI / 4,
  chargeSeconds: 0.8,
  readySeconds: 1.2,
  boostSeconds: 0.7,
  cooldownSeconds: 0.5,
  boostAcceleration: 9.5,
  boostMaximumSpeed: 19.5,
  groundTolerance: 0.8,
  exitSteerThreshold: 0.12,
  exitIntentSeconds: 0.6,
  exitMinimumLaneChange: 0.6,
} as const;

export type SlipstreamState = {
  targetId: string | null;
  charge: number;
  readyRemaining: number;
  boostRemaining: number;
  boostRevision: number;
  cooldownRemaining: number;
  exitDirection: -1 | 0 | 1;
  exitIntentRemaining: number;
  readyLane: number;
};

export type SlipstreamSnapshot = Readonly<{
  charge: number;
  ready: boolean;
  boostRemaining: number;
  boostRevision: number;
}>;

export type SlipstreamRacer = Readonly<{
  id: string;
  position: readonly [number, number, number];
  yaw: number;
  speed: number;
  roadIndex: number;
  roadYaw: number;
  laneOffset: number;
  eligible: boolean;
  steer: number;
}>;

export function createSlipstreamState(): SlipstreamState {
  return { targetId: null, charge: 0, readyRemaining: 0, boostRemaining: 0, boostRevision: 0, cooldownRemaining: 0, exitDirection: 0, exitIntentRemaining: 0, readyLane: 0 };
}

export function interruptSlipstream(state: SlipstreamState) {
  state.targetId = null; state.charge = 0; state.readyRemaining = 0;
  state.boostRemaining = 0; state.cooldownRemaining = SLIPSTREAM_CONFIG.cooldownSeconds;
  state.exitDirection = 0; state.exitIntentRemaining = 0;
  state.readyLane = 0;
}

export function slipstreamSnapshot(state: SlipstreamState): SlipstreamSnapshot {
  return { charge: Math.min(1, state.charge / SLIPSTREAM_CONFIG.chargeSeconds), ready: state.readyRemaining > 0,
    boostRemaining: state.boostRemaining, boostRevision: state.boostRevision };
}

export function slipstreamGeometry(follower: SlipstreamRacer, leader: SlipstreamRacer, exiting = false) {
  const config = SLIPSTREAM_CONFIG;
  if (!follower.eligible || !leader.eligible || follower.id === leader.id ||
    follower.speed < config.minimumSpeed || leader.speed < config.minimumSpeed || follower.roadIndex !== leader.roadIndex ||
    Math.abs(follower.position[1] - leader.position[1]) > config.heightTolerance ||
    Math.cos(follower.yaw - leader.yaw) < Math.cos(exiting ? config.maximumExitHeadingDifference : config.maximumHeadingDifference) ||
    Math.cos(follower.roadYaw - leader.roadYaw) < Math.cos(config.maximumHeadingDifference)) return null;
  const dx = follower.position[0] - leader.position[0], dz = follower.position[2] - leader.position[2];
  // A car following a curve must not count as pulling out merely because the
  // front kart is angled. Compare road-relative lanes and the shared tangent.
  const roadYaw = Math.atan2(Math.sin(follower.roadYaw) + Math.sin(leader.roadYaw), Math.cos(follower.roadYaw) + Math.cos(leader.roadYaw));
  const forwardX = -Math.sin(roadYaw), forwardZ = -Math.cos(roadYaw);
  const signedLateral = follower.laneOffset - leader.laneOffset;
  return { gap: -(dx * forwardX + dz * forwardZ), lateral: Math.abs(signedLateral), signedLateral };
}

/** Mutable per-racer state; clients receive progress only, never choose a target. */
export function stepSlipstream(state: SlipstreamState, follower: SlipstreamRacer,
  racers: Iterable<SlipstreamRacer>, delta: number,
  clear: (from: SlipstreamRacer, to: SlipstreamRacer) => boolean) {
  const dt = Math.max(0, Math.min(delta, 0.05)), config = SLIPSTREAM_CONFIG;
  if (!follower.eligible || follower.speed < config.minimumSpeed) { interruptSlipstream(state); return; }
  state.boostRemaining = Math.max(0, state.boostRemaining - dt);
  state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
  if (state.boostRemaining > 0 || state.cooldownRemaining > 0) return;
  let leader: SlipstreamRacer | null = null, closest = Infinity;
  for (const racer of racers) {
    if (state.readyRemaining > 0 && racer.id !== state.targetId) continue;
    const geometry = slipstreamGeometry(follower, racer, state.readyRemaining > 0);
    if (!geometry || geometry.gap < (state.readyRemaining > 0 ? config.exitMinimumGap : config.minimumGap) ||
      geometry.gap > config.maximumGap || geometry.lateral > (state.readyRemaining > 0 ? config.exitHalfWidth : config.halfWidth) ||
      geometry.gap >= closest || !clear(follower, racer)) continue;
    leader = racer; closest = geometry.gap;
  }
  if (!leader) {
    state.targetId = null; state.charge = 0; state.readyRemaining = 0;
    state.exitDirection = 0; state.exitIntentRemaining = 0;
    state.readyLane = 0;
    return;
  }
  if (state.readyRemaining > 0) {
    state.exitIntentRemaining = Math.max(0, state.exitIntentRemaining - dt);
    // Countersteering to settle the car must not replace the initial lane-change
    // intent before its short buffer expires. A fresh exit can follow expiry.
    if (Math.abs(follower.steer) >= config.exitSteerThreshold &&
      (state.exitIntentRemaining === 0 || Math.sign(follower.steer) === state.exitDirection)) {
      state.exitDirection = follower.steer > 0 ? 1 : -1; state.exitIntentRemaining = config.exitIntentSeconds;
    }
    state.readyRemaining = Math.max(0, state.readyRemaining - dt);
    if (state.readyRemaining === 0) { interruptSlipstream(state); return; }
    const geometry = slipstreamGeometry(follower, leader, true);
    if (geometry && state.exitIntentRemaining > 0 && geometry.signedLateral * state.exitDirection > config.halfWidth &&
      (follower.laneOffset - state.readyLane) * state.exitDirection > config.exitMinimumLaneChange) {
      state.targetId = null; state.charge = 0; state.readyRemaining = 0;
      state.boostRemaining = config.boostSeconds; state.cooldownRemaining = config.boostSeconds + config.cooldownSeconds;
      state.boostRevision++;
      state.exitDirection = 0; state.exitIntentRemaining = 0;
    }
    return;
  }
  if (state.targetId !== leader.id) {
    state.targetId = leader.id; state.charge = 0;
    state.exitDirection = 0; state.exitIntentRemaining = 0;
  }
  state.charge = Math.min(config.chargeSeconds, state.charge + dt);
  if (state.charge >= config.chargeSeconds - 1e-8) {
    state.charge = config.chargeSeconds; state.readyRemaining = config.readySeconds; state.readyLane = follower.laneOffset;
  }
}
