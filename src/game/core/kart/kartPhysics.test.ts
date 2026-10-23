import { describe, expect, it } from "vitest";
import { KART_CONFIG } from "./kartConfig";
import { clearDriftBoost } from "./driftSystem";
import { createInitialKartState, getKartLateralSpeed, stepKartSimulation } from "./kartPhysics";
import type { KartInput, KartSimulationState } from "./kartTypes";

const neutral: KartInput = { throttle: 0, brake: 0, steer: 0, drift: false };

function stepMany(state: KartSimulationState, input: KartInput, count: number) {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = stepKartSimulation(next, input, KART_CONFIG.fixedTimeStep).state;
  }
  return next;
}

describe("kartPhysics", () => {
  it("accelerates without exceeding the configured top speed", () => {
    const state = stepMany(
      createInitialKartState(),
      { ...neutral, throttle: 1 },
      600,
    );

    expect(state.speed).toBeCloseTo(KART_CONFIG.maxForwardSpeed, 5);
  });

  it("coasts toward rest when throttle is released", () => {
    const moving = stepMany(createInitialKartState(), { ...neutral, throttle: 1 }, 60);
    const coasting = stepMany(moving, neutral, 60);

    expect(coasting.speed).toBeLessThan(moving.speed);
    expect(coasting.speed).toBeGreaterThanOrEqual(0);
  });

  it("brakes to zero and then reverses within the reverse speed limit", () => {
    const moving = stepMany(createInitialKartState(), { ...neutral, throttle: 1 }, 60);
    const reversing = stepMany(moving, { ...neutral, brake: 1 }, 300);

    expect(reversing.speed).toBeCloseTo(-KART_CONFIG.maxReverseSpeed, 5);
  });

  it("clamps steering input and reverses steering direction while backing up", () => {
    const forward = stepKartSimulation(
      { ...createInitialKartState(), speed: 10 },
      { ...neutral, steer: 4 },
      KART_CONFIG.fixedTimeStep,
    ).state;
    const reverse = stepKartSimulation(
      { ...createInitialKartState(), speed: -4 },
      { ...neutral, steer: 1 },
      KART_CONFIG.fixedTimeStep,
    ).state;

    expect(forward.yaw).toBeLessThan(0);
    expect(reverse.yaw).toBeGreaterThan(0);
  });

  it.each(KART_CONFIG.driftTiers)(
    "charges drift tier $tier and applies its configured finite turbo",
    (tierConfig) => {
      let state: KartSimulationState = { ...createInitialKartState(), speed: 10 };
      const driftInput = { ...neutral, throttle: 1, steer: 1, drift: true };
      const chargeSteps = Math.ceil(
        tierConfig.chargeTime / KART_CONFIG.fixedTimeStep,
      ) + 2;

      state = stepMany(state, driftInput, chargeSteps);
      expect(state.drift.active).toBe(true);
      expect(state.drift.chargeTier).toBe(tierConfig.tier);

      const release = stepKartSimulation(state, neutral, KART_CONFIG.fixedTimeStep);
      expect(release.turboTriggered).toBe(true);
      expect(release.turboTierTriggered).toBe(tierConfig.tier);
      expect(release.state.drift.turboRemaining).toBe(tierConfig.duration);
      expect(release.state.drift.turboTier).toBe(tierConfig.tier);
      expect(release.state.speed).toBeGreaterThan(state.speed);
      expect(release.state.speed).toBeLessThanOrEqual(tierConfig.maxSpeed);
      const capped = stepKartSimulation(
        { ...release.state, speed: tierConfig.maxSpeed + 10 },
        neutral,
        KART_CONFIG.fixedTimeStep,
      ).state;
      expect(capped.speed).toBeLessThanOrEqual(KART_CONFIG.driftTiers[2].maxSpeed);

      const finished = stepMany(
        release.state,
        neutral,
        Math.ceil(tierConfig.duration / KART_CONFIG.fixedTimeStep) + 2,
      );
      expect(finished.drift.turboRemaining).toBe(0);
      expect(finished.drift.turboTier).toBe(0);
    },
  );

  it("does not charge drift below the minimum speed", () => {
    const state = stepMany(
      createInitialKartState(),
      { ...neutral, steer: 1, drift: true },
      90,
    );

    expect(state.drift.active).toBe(false);
    expect(state.drift.charge).toBe(0);
  });

  it("clears an active turbo without retaining its tier", () => {
    const cleared = clearDriftBoost({
      active: false,
      direction: 0,
      charge: 0,
      chargeTier: 0,
      turboRemaining: 1,
      turboTier: 3,
    });
    expect(cleared.turboRemaining).toBe(0);
    expect(cleared.turboTier).toBe(0);
  });
});

describe("lateral grip", () => {
  it("quickly settles ordinary steering slip", () => {
    let lateral = 4;
    for (let i = 0; i < 12; i++) lateral = getKartLateralSpeed(lateral, 12, 0, false, 1 / 60);
    expect(Math.abs(lateral)).toBeLessThan(0.04);
  });
  it("produces symmetric, bounded drift and recovers on release", () => {
    const simulate = (steer: number) => {
      let lateral = 0;
      for (let i = 0; i < 120; i++) lateral = getKartLateralSpeed(lateral, 12, steer, true, 1 / 60);
      return lateral;
    };
    const right = simulate(1);
    expect(right).toBeLessThan(-4);
    expect(right).toBeCloseTo(-simulate(-1));
    expect(Math.abs(right)).toBeLessThanOrEqual(12 * Math.tan(KART_CONFIG.driftSlipAngle));
    expect(Math.abs(getKartLateralSpeed(right, 12, 1, false, 1 / 60))).toBeLessThan(Math.abs(right));
  });
});
