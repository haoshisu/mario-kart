import { describe, expect, it } from "vitest";
import { createItemState, receiveItemHit, tickItemEffects } from "./ItemEffects";
import { createSeededRandom, ItemSystem, sweptDistance } from "./ItemSystem";
import { BOOST_PADS, ITEM_BOXES, ITEM_CONFIG, ITEM_KINDS, type ItemKind } from "./itemConfig";
import type { ItemRacer } from "./itemTypes";

const box = ITEM_BOXES[0];
const racer = (id: string, position = box.position): ItemRacer => ({
  id, position, previousPosition: position, yaw: box.yaw, eligible: true,
});
function seedFor(kind: ItemKind) {
  for (let seed = 1; seed < 100_000; seed += 1) {
    if (ITEM_KINDS[Math.floor(createSeededRandom(seed)() * ITEM_KINDS.length)] === kind) return seed;
  }
  throw new Error("Missing deterministic item seed");
}
function pickup(kind: ItemKind) {
  const system = new ItemSystem(seedFor(kind));
  system.addPlayer("a");
  system.step(1 / 60, [racer("a")], 1);
  expect(system.getPlayer("a")?.held).toBe(kind);
  return system;
}

describe("authoritative item rules", () => {
  it("replays seeded drops without replacing the front item", () => {
    const run = () => {
      const system = new ItemSystem(42);
      system.addPlayer("a");
      const drops = [];
      for (let tick = 0; tick < 40; tick += 1) {
        system.step(ITEM_CONFIG.boxCooldown + 1, [racer("a")], tick);
        const state = system.getPlayer("a");
        drops.push(state?.held);
        system.step(0.1, [racer("a", ITEM_BOXES[4].position)], tick);
        expect(system.getPlayer("a")?.held).toBe(state?.held);
        expect(system.use(racer("a"), system.getPlayer("a")?.revision ?? -1, tick)).toBe(true);
      }
      return drops;
    };
    expect(run()).toEqual(run());
    expect(new Set(run()).size).toBe(ITEM_KINDS.length);
  });
  it("stores exactly two items, advances the queue, and rejects stale requests", () => {
    const system = new ItemSystem(42);
    system.addPlayer("a");
    system.step(.1, [racer("a", ITEM_BOXES[0].position)], 1);
    const first = system.getPlayer("a")!;
    system.step(.1, [racer("a", ITEM_BOXES[4].position)], 2);
    const full = system.getPlayer("a")!;
    expect(full.held).toBe(first.held);
    expect(full.reserve).not.toBeNull();
    system.step(.1, [racer("a", ITEM_BOXES[8].position)], 3);
    expect(system.getPlayer("a")).toMatchObject({ held: full.held, reserve: full.reserve, revision: full.revision });
    expect(system.snapshot().boxes.find((box) => box.id === ITEM_BOXES[8].id)?.remaining).toBe(0);
    expect(system.use(racer("a"), first.revision, 4)).toBe(false);
    expect(system.use(racer("a"), full.revision, 4)).toBe(true);
    expect(system.getPlayer("a")).toMatchObject({ held: full.reserve, reserve: null });
    expect(system.use(racer("a"), full.revision, 5)).toBe(false);
    system.clearPlayer("a", 6, ITEM_BOXES[0].position);
    expect(system.getPlayer("a")).toMatchObject({ held: null, reserve: null });
  });
  it("rejects unknown/ineligible racers, resolves simultaneous pickup and respects respawn cooldown", () => {
    const system = new ItemSystem(1);
    system.addPlayer("a"); system.addPlayer("b");
    system.step(0.1, [racer("unknown"), { ...racer("a"), eligible: false }], 1);
    expect(system.getPlayer("a")?.held).toBeNull();
    system.step(0.1, [racer("b"), racer("a")], 2);
    expect(system.getPlayer("a")?.held).not.toBeNull();
    expect(system.getPlayer("b")?.held).toBeNull();
    const state = system.getPlayer("a");
    expect(system.use({ ...racer("a"), eligible: false }, state?.revision ?? -1, 2)).toBe(false);
    expect(system.use(racer("a"), state?.revision ?? -1, 2)).toBe(true);
    expect(system.use(racer("a"), state?.revision ?? -1, 2)).toBe(false);
    system.step(1, [racer("b")], 3);
    expect(system.getPlayer("b")?.held).toBeNull();
    system.step(ITEM_CONFIG.boxCooldown, [racer("b")], 4);
    expect(system.getPlayer("b")?.held).not.toBeNull();
  });
  it("uses swept pickup tests without missing fast crossings", () => {
    expect(sweptDistance([0, 0], [-10, 0], [10, 0])).toBe(0);
    const system = new ItemSystem(1);
    system.addPlayer("a");
    system.step(1 / 60, [{ ...racer("a"), previousPosition: [box.position[0] - 3, box.position[1]],
      position: [box.position[0] + 3, box.position[1]] }], 1);
    expect(system.getPlayer("a")?.held).not.toBeNull();
  });
  it("allows shield and boost together, absorbs once, and prevents chain locking", () => {
    const state = createItemState();
    state.shieldRemaining = ITEM_CONFIG.shieldSeconds;
    state.boostRemaining = ITEM_CONFIG.boostSeconds;
    expect(receiveItemHit(state)).toBe("shield");
    expect(state.shieldRemaining).toBe(0);
    expect(state.boostRemaining).toBe(ITEM_CONFIG.boostSeconds);
    expect(receiveItemHit(state)).toBe("immune");
    tickItemEffects(state, ITEM_CONFIG.recoverySeconds);
    expect(receiveItemHit(state)).toBe("hit");
    expect(state.boostRemaining).toBe(0);
    tickItemEffects(state, ITEM_CONFIG.hitLockSeconds);
    expect(state.lockRemaining).toBe(0);
    expect(receiveItemHit(state)).toBe("immune");
    tickItemEffects(state, ITEM_CONFIG.recoverySeconds);
    expect(receiveItemHit(state)).toBe("hit");
  });
  it("arms traps, ignores their owner, hits once and attributes the attack", () => {
    const system = pickup("trap");
    system.addPlayer("b");
    system.use(racer("a"), system.getPlayer("a")?.revision ?? -1, 2);
    const trap = system.snapshot().traps[0];
    system.step(0.1, [racer("b", trap.position)], 3);
    expect(system.getPlayer("b")?.lockRemaining).toBe(0);
    system.step(1, [racer("a", trap.position)], 4);
    expect(system.snapshot().traps).toHaveLength(1);
    system.step(0.01, [racer("b", trap.position)], 5);
    expect(system.snapshot().traps).toHaveLength(0);
    expect(system.getPlayer("b")?.lockRemaining).toBe(ITEM_CONFIG.hitLockSeconds);
    expect(system.snapshot().events.at(-1)).toMatchObject({ kind: "hit", sourceId: "a", playerId: "b" });
  });
  it("cleans up disconnected owners, respawn effects and stale rematch requests", () => {
    const system = pickup("trap");
    const revision = system.getPlayer("a")?.revision ?? -1;
    system.use(racer("a"), revision, 2);
    system.clearPlayer("a", 3, box.position, true);
    expect(system.snapshot().traps).toHaveLength(0);
    expect(system.getPlayer("a")).toMatchObject({ held: null, boostRemaining: 0,
      lockRemaining: 0, immunityRemaining: ITEM_CONFIG.recoverySeconds });
    system.reset(seedFor("boost"));
    system.step(0.1, [racer("a")], 4);
    expect(system.use(racer("a"), revision, 5)).toBe(false);
    system.removePlayer("a");
    expect(system.getPlayer("a")).toBeUndefined();
  });
  it.each(["disc", "orb"] as const)("uses %s once and attributes its authoritative hit", (kind) => {
    const system = pickup(kind);
    system.addPlayer("b");
    const owner: ItemRacer = { ...racer("a", [-10, -10.5]), yaw: -Math.PI / 2 };
    const victim = racer("b", [-4, -10.5]);
    const revision = system.getPlayer("a")!.revision;
    expect(system.use(owner, revision, 2, [owner, victim])).toBe(true);
    expect(system.use(owner, revision, 2, [owner, victim])).toBe(false);
    expect(system.snapshot().projectiles).toHaveLength(1);
    system.step(0.25, [owner, victim], 3);
    expect(system.getPlayer("b")?.lockRemaining).toBe(ITEM_CONFIG.hitLockSeconds);
    expect(system.snapshot().events).toContainEqual(expect.objectContaining({ kind: "hit", item: kind, sourceId: "a", playerId: "b" }));
    expect(system.snapshot().projectiles).toHaveLength(0);
  });
  it.each(["shield", "recovery"] as const)("blocks a projectile with %s protection", (protection) => {
    let seed = 1;
    while (true) {
      const random = createSeededRandom(seed);
      if (ITEM_KINDS[Math.floor(random() * ITEM_KINDS.length)] === "disc" &&
        ITEM_KINDS[Math.floor(random() * ITEM_KINDS.length)] === "shield") break;
      seed++;
    }
    const system = new ItemSystem(seed);
    system.addPlayer("a"); system.addPlayer("b");
    system.step(0.01, [racer("a"), racer("b", ITEM_BOXES[5].position)], 1);
    const owner = { ...racer("a", [-10, -10.5]), yaw: -Math.PI / 2 };
    const victim = racer("b", [-4, -10.5]);
    if (protection === "shield") system.use(victim, system.getPlayer("b")!.revision, 2);
    else system.protect("b", 1);
    system.use(owner, system.getPlayer("a")!.revision, 2);
    system.step(0.25, [owner, victim], 3);
    expect(system.getPlayer("b")?.lockRemaining).toBe(0);
    expect(system.snapshot().projectiles).toHaveLength(0);
    expect(system.snapshot().events).toContainEqual(expect.objectContaining({ kind: "immune", sourceId: "a", playerId: "b" }));
  });
  it("removes an owner's projectiles on disconnect/respawn and rejects stale uses after rematch", () => {
    const system = pickup("orb");
    const owner = { ...racer("a", [-10, -10.5]), yaw: -Math.PI / 2 };
    const revision = system.getPlayer("a")!.revision;
    system.use(owner, revision, 2);
    expect(system.snapshot().projectiles).toHaveLength(1);
    system.clearPlayer("a", 3, owner.position, true);
    expect(system.snapshot().projectiles).toHaveLength(0);
    system.reset(seedFor("disc"));
    system.step(0.1, [racer("a")], 4);
    expect(system.use(owner, revision, 5)).toBe(false);
  });
  it("limits boost pads per player and clears boost on expiry", () => {
    const system = new ItemSystem(1);
    system.addPlayer("a");
    const onPad = racer("a", BOOST_PADS[0].position);
    system.step(0.1, [onPad], 1);
    expect(system.getPlayer("a")?.boostRemaining).toBe(ITEM_CONFIG.padBoostSeconds);
    system.step(1, [onPad], 2);
    expect(system.getPlayer("a")?.boostRemaining).toBe(0);
    system.step(ITEM_CONFIG.padCooldown, [onPad], 3);
    expect(system.getPlayer("a")?.boostRemaining).toBe(ITEM_CONFIG.padBoostSeconds);
  });
  it("refreshes a consecutive pad before the previous pad cooldown ends", () => {
    const system = new ItemSystem(1);
    system.addPlayer("a");
    system.step(.1, [racer("a", BOOST_PADS[1].position)], 1);
    system.step(.5, [], 2);
    expect(system.getPlayer("a")?.boostRemaining).toBeCloseTo(.4);
    system.step(.1, [racer("a", BOOST_PADS[6].position)], 3);
    expect(system.getPlayer("a")?.boostRemaining).toBe(ITEM_CONFIG.padBoostSeconds);
    system.step(.5, [racer("a", BOOST_PADS[6].position)], 4);
    expect(system.getPlayer("a")?.boostRemaining).toBeCloseTo(.4);
  });
  it("expires unused traps and bounds transient events", () => {
    const system = pickup("trap");
    system.use(racer("a"), system.getPlayer("a")?.revision ?? -1, 2);
    system.step(ITEM_CONFIG.trapLifetime + 1, [], 3);
    expect(system.snapshot().traps).toHaveLength(0);
    expect(system.snapshot().events).toHaveLength(0);
    for (let tick = 4; tick < 104; tick += 1) system.clearPlayer("a", tick, box.position, true);
    expect(system.snapshot().events).toHaveLength(ITEM_CONFIG.maximumEvents);
  });
});

describe("leader strike (comet)", () => {
  const ranked = (id: string, rank: number, position: readonly [number, number]): ItemRacer => ({
    id, position, previousPosition: position, yaw: 0, eligible: true, rank, racerCount: 3 });
  function armed() {
    const system = new ItemSystem(1, { ITEM_BOXES: [], BOOST_PADS: [] }, []);
    for (const id of ["leader", "middle", "last"]) system.addPlayer(id);
    // Hand the comet directly so the test does not depend on drop odds.
    (system as unknown as { players: Map<string, { held: ItemKind | null }> }).players.get("last")!.held = "comet";
    const racers = [ranked("leader", 1, [0, -60]), ranked("middle", 2, [0, -30]), ranked("last", 3, [0, 0])];
    return { system, racers };
  }
  it("locks the leader immediately and strikes after the warning", () => {
    const { system, racers } = armed();
    expect(system.use(racers[2], system.getPlayer("last")!.revision, 1, racers)).toBe(true);
    expect(system.snapshot().events).toContainEqual(expect.objectContaining({ kind: "lock", playerId: "leader", sourceId: "last", item: "comet" }));
    system.step(ITEM_CONFIG.cometWarningSeconds - .1, racers, 2);
    expect(system.getPlayer("leader")?.lockRemaining).toBe(0);
    system.step(.2, racers, 3);
    expect(system.getPlayer("leader")?.lockRemaining).toBeGreaterThan(0);
    expect(system.getPlayer("middle")?.lockRemaining).toBe(0);
    expect(system.snapshot().events).toContainEqual(expect.objectContaining({ kind: "hit", playerId: "leader", sourceId: "last", item: "comet" }));
  });
  it("is blocked by a shield raised during the warning and cleared by a rematch", () => {
    const { system, racers } = armed();
    system.use(racers[2], system.getPlayer("last")!.revision, 1, racers);
    (system as unknown as { players: Map<string, { shieldRemaining: number }> }).players.get("leader")!.shieldRemaining = 5;
    system.step(ITEM_CONFIG.cometWarningSeconds + .1, racers, 2);
    expect(system.getPlayer("leader")?.lockRemaining).toBe(0);
    expect(system.snapshot().events).toContainEqual(expect.objectContaining({ kind: "immune", playerId: "leader", item: "shield" }));
    const again = armed();
    again.system.use(again.racers[2], again.system.getPlayer("last")!.revision, 1, again.racers);
    again.system.reset(2);
    again.system.step(ITEM_CONFIG.cometWarningSeconds + .1, again.racers, 2);
    expect(again.system.getPlayer("leader")?.lockRemaining).toBe(0);
  });
});
