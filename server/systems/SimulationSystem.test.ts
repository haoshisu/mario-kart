import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { createMarkerCrossingSegment } from "../../src/game/core/race/checkpointSystem";
import { CHECKPOINTS, FINISH_MARKER, type RaceMarker } from "../../src/game/core/race/raceTrack";
import { NETWORK_CONFIG, PLAYER_COLORS } from "../../src/game/network/networkConfig";
import { GUARD_RAIL_SEGMENTS } from "../../src/game/track/trackGeometry";
import { SimulationSystem } from "./SimulationSystem";
import { ITEM_BOXES, ITEM_CONFIG, ITEM_KINDS } from "../../src/game/core/items/itemConfig";
import { KART_START } from "../../src/game/core/kart/kartConfig";
import { createSeededRandom } from "../../src/game/core/items/ItemSystem";

const FIXED_MILLISECONDS = 1_000 / NETWORK_CONFIG.simulationRateHz;

function placeForCrossing(
  simulation: SimulationSystem,
  playerIds: readonly string[],
  marker: RaceMarker,
  side: "previous" | "current",
) {
  const segment = createMarkerCrossingSegment(marker, "forward");
  const point = segment[side];
  const spacing = 1.55;
  playerIds.forEach((playerId, index) => {
    const laneOffset = (index - (playerIds.length - 1) / 2) * spacing;
    simulation.resetPlayerPose(
      playerId,
      [
        point[0] + marker.right[0] * laneOffset,
        marker.respawn.position[1],
        point[1] + marker.right[1] * laneOffset,
      ],
      marker.respawn.yaw,
    );
  });
}

describe("SimulationSystem", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("ignores late disconnect callbacks and duplicate cleanup after freeing the physics world", () => {
    const simulation = new SimulationSystem(1);
    simulation.addPlayer("driver", "Driver", "coral");
    simulation.start();
    simulation.dispose();
    expect(() => {
      simulation.setConnection("driver", "disconnected");
      simulation.markDnf("driver");
      simulation.removePlayer("driver");
      simulation.step();
      simulation.dispose();
    }).not.toThrow();
    expect(simulation.getSnapshot().players).toEqual([]);
  });

  it("authoritatively picks up, uses and clears an item, rejecting replay and non-racing requests", () => {
    const simulation = new SimulationSystem(1);
    try {
      simulation.addPlayer("driver", "Driver", "coral");
      expect(simulation.useItem("driver", 0)).toBe(false);
      simulation.start();
      let now = 1000;
      while (simulation.getPhase() === "countdown") {
        simulation.step(now += FIXED_MILLISECONDS);
      }
      const box = ITEM_BOXES[1];
      simulation.resetPlayerPose("driver", [box.position[0], box.height + KART_START.position[1], box.position[1]], box.yaw);
      simulation.step(now += FIXED_MILLISECONDS);
      const picked = simulation.getSnapshot(now).players[0].item;
      expect(picked.held).toBe("boost");
      expect(simulation.useItem("unknown", picked.revision)).toBe(false);
      expect(simulation.useItem("driver", picked.revision)).toBe(true);
      expect(simulation.useItem("driver", picked.revision)).toBe(false);
      expect(simulation.getSnapshot(now).players[0].item.boostRemaining).toBe(ITEM_CONFIG.boostSeconds);
      for (let tick = 0; tick < 30; tick += 1) simulation.step(now += FIXED_MILLISECONDS);
      expect(simulation.getSnapshot(now).players[0].speed).toBeGreaterThan(0);
      simulation.setConnection("driver", "reconnecting");
      expect(simulation.getSnapshot(now).players[0].item.boostRemaining).toBe(0);
      simulation.markDnf("driver");
      expect(simulation.useItem("driver", picked.revision)).toBe(false);
    } finally { simulation.dispose(); }
  });

  it.each(["disc", "orb"] as const)("resolves %s damage through the authoritative simulation", (kind) => {
    let seed = 1;
    while (ITEM_KINDS[Math.floor(createSeededRandom(seed)() * ITEM_KINDS.length)] !== kind) seed++;
    const simulation = new SimulationSystem(seed);
    try {
      simulation.addPlayer("owner", "Owner", "coral");
      simulation.addPlayer("victim", "Victim", "sun");
      simulation.start();
      let now = 1000;
      while (simulation.getPhase() === "countdown") simulation.step(now += FIXED_MILLISECONDS);
      const box = ITEM_BOXES[0];
      simulation.resetPlayerPose("owner", [box.position[0], box.height + KART_START.position[1], box.position[1]], box.yaw);
      simulation.step(now += FIXED_MILLISECONDS);
      const held = simulation.getSnapshot(now).players.find((player) => player.id === "owner")!.item;
      expect(held.held).toBe(kind);
      simulation.resetPlayerPose("owner", [-10, KART_START.position[1], -10.5], -Math.PI / 2);
      simulation.resetPlayerPose("victim", [-4, KART_START.position[1], -10.5], -Math.PI / 2);
      expect(simulation.useItem("owner", held.revision)).toBe(true);
      expect(simulation.getSnapshot(now).items.projectiles).toHaveLength(1);
      for (let tick = 0; tick < 20; tick++) simulation.step(now += FIXED_MILLISECONDS);
      const snapshot = simulation.getSnapshot(now);
      expect(snapshot.items.projectiles).toHaveLength(0);
      expect(snapshot.players.find((player) => player.id === "victim")?.spinOutRemaining).toBeGreaterThan(0);
      expect(snapshot.items.events).toContainEqual(expect.objectContaining({ kind: "hit", item: kind, sourceId: "owner", playerId: "victim" }));
    } finally { simulation.dispose(); }
  });
  it.each(["hit", "shield", "disconnect"] as const)("resolves a real trap and %s through authoritative snapshots", (scenario) => {
    let seed = 1;
    for (; seed < 100_000; seed += 1) {
      const random = createSeededRandom(seed);
      if (Math.floor(random() * ITEM_KINDS.length) === 2 && Math.floor(random() * ITEM_KINDS.length) === 1) break;
    }
    const simulation = new SimulationSystem(seed);
    try {
      simulation.addPlayer("owner", "Owner", "coral");
      simulation.addPlayer("victim", "Victim", "sun");
      simulation.start();
      let now = 1000;
      while (simulation.getPhase() === "countdown") simulation.step(now += FIXED_MILLISECONDS);
      const box = ITEM_BOXES[1];
      simulation.resetPlayerPose("owner", [box.position[0], box.height + KART_START.position[1], box.position[1]], box.yaw);
      simulation.step(now += FIXED_MILLISECONDS);
      const owner = simulation.getSnapshot(now).players.find((player) => player.id === "owner");
      expect(owner?.item.held).toBe("trap");
      expect(simulation.useItem("owner", owner?.item.revision ?? -1)).toBe(true);
      const trap = simulation.getSnapshot(now).items.traps[0];
      if (scenario === "shield") {
        const shieldBox = ITEM_BOXES[5];
        simulation.resetPlayerPose("victim", [shieldBox.position[0], shieldBox.height + KART_START.position[1], shieldBox.position[1]], shieldBox.yaw);
        simulation.step(now += FIXED_MILLISECONDS);
        const victim = simulation.getSnapshot(now).players.find((player) => player.id === "victim");
        expect(victim?.item.held).toBe("shield");
        expect(simulation.useItem("victim", victim?.item.revision ?? -1)).toBe(true);
      }
      simulation.resetPlayerPose("victim", [trap.position[0], (trap.height ?? 0) + KART_START.position[1], trap.position[1]], 0);
      if (scenario === "disconnect") simulation.setConnection("owner", "reconnecting");
      for (let tick = 0; tick < 35; tick += 1) simulation.step(now += FIXED_MILLISECONDS);
      const snapshot = simulation.getSnapshot(now);
      const victim = snapshot.players.find((player) => player.id === "victim");
      expect(snapshot.items.traps).toHaveLength(0);
      if (scenario === "hit") {
        expect(victim?.item.lockRemaining).toBeGreaterThan(0);
        expect(victim?.spinOutRemaining).toBeGreaterThan(0);
        expect(victim?.impactKind).toBe("item");
        expect(snapshot.items.events).toContainEqual(expect.objectContaining({ kind: "hit", playerId: "victim", sourceId: "owner" }));
      } else {
        expect(victim?.item.lockRemaining).toBe(0);
        if (scenario === "shield") {
          expect(victim?.item.shieldRemaining).toBe(0);
          expect(snapshot.items.events).toContainEqual(expect.objectContaining({ kind: "immune", item: "shield" }));
        }
      }
    } finally { simulation.dispose(); }
  });

  for (const scenario of ["head-on", "rear-end", "side-swipe"] as const) {
    it(`separates a real ${scenario} contact while both drivers keep their inputs`, () => {
      const simulation = new SimulationSystem(1);
      try {
        simulation.addPlayer("first", "First", "coral");
        simulation.addPlayer("second", "Second", "sun");
        simulation.start();
        let now = 1000;
        while (simulation.getPhase() === "countdown") simulation.step(now += FIXED_MILLISECONDS);
        const sideways = scenario === "side-swipe";
        simulation.resetPlayerPose("first", [-8, KART_START.position[1], -10.5 - (sideways ? 1.6 : 0)], -Math.PI / 2 - (sideways ? .35 : 0));
        simulation.resetPlayerPose("second", [sideways ? -8 : 2, KART_START.position[1], -10.5 + (sideways ? 1.6 : 0)], scenario === "head-on" ? Math.PI / 2 : -Math.PI / 2 + (sideways ? .35 : 0));
        let collidedAt = -1, separationAtContact = 0, maximumSeparation = 0;
        let secondX = 0;
        for (let tick = 0; tick < 180; tick++) {
          now += FIXED_MILLISECONDS;
          if (tick % 3 === 0) for (const id of ["first", "second"]) {
            simulation.input.receive(id, { sequence: tick, sentAt: now,
              input: { throttle: scenario === "rear-end" && id === "second" ? 0 : 1, brake: 0, steer: 0, drift: false } }, now);
          }
          simulation.step(now);
          const players = simulation.getSnapshot(now).players;
          const first = players.find(p => p.id === "first")!, second = players.find(p => p.id === "second")!;
          const separation = sideways ? Math.abs(second.position[2] - first.position[2]) : second.position[0] - first.position[0];
          if (collidedAt < 0 && first.impactRevision > 0 && first.impactKind === "kart") {
            collidedAt = tick; separationAtContact = separation; secondX = second.position[0];
          }
          if (collidedAt >= 0) {
            maximumSeparation = Math.max(maximumSeparation, separation);
            expect(players.every(player => player.spinOutRemaining === 0 && player.item.immunityRemaining === 0)).toBe(true);
            if (scenario === "rear-end" && tick === collidedAt + 12) expect(second.position[0] - secondX).toBeGreaterThan(.3);
            if (tick === collidedAt + 12) break;
          }
        }
        expect(collidedAt).toBeGreaterThanOrEqual(0);
        expect(maximumSeparation - separationAtContact).toBeGreaterThan(.12);
      } finally { simulation.dispose(); }
    });
  }

  it("clears a four-kart resting pileup and resumes forward driving", () => {
    const simulation = new SimulationSystem(1);
    try {
      for (let i = 0; i < 4; i++) simulation.addPlayer(`p${i}`, `Player ${i}`, PLAYER_COLORS[i]);
      simulation.start();
      let now = 1000;
      while (simulation.getPhase() === "countdown") simulation.step(now += FIXED_MILLISECONDS);
      for (let i = 0; i < 4; i++) simulation.resetPlayerPose(`p${i}`, [-18, KART_START.position[1], -11.4 + i * .6], -Math.PI / 2);
      for (let tick = 0; tick < 120; tick++) {
        now += FIXED_MILLISECONDS;
        if (tick % 3 === 0) for (let i = 0; i < 4; i++) simulation.input.receive(`p${i}`, {
          sequence: tick, sentAt: now, input: { throttle: 1, brake: 0, steer: 0, drift: false },
        }, now);
        simulation.step(now);
      }
      const players = [...simulation.getSnapshot(now).players].sort((a, b) => a.position[2] - b.position[2]);
      expect(players.every(player => player.speed > 15 && player.position[0] > -3 && player.spinOutRemaining === 0)).toBe(true);
      for (let i = 1; i < players.length; i++) expect(players[i].position[2] - players[i - 1].position[2]).toBeGreaterThan(1.2);
    } finally { simulation.dispose(); }
  });

  it("preserves snapshot sequence after a long lobby and another race", () => {
    const simulation = new SimulationSystem();
    simulation.addPlayer("p1", "One", "coral");
    simulation.addPlayer("p2", "Two", "sun");
    for (let tick = 0; tick < 600; tick += 1) simulation.step(1000 + tick * FIXED_MILLISECONDS);
    const lobbyTick = simulation.getTick();
    simulation.start();
    expect(simulation.getTick()).toBe(lobbyTick);
    for (let tick = 0; tick < 3; tick += 1) simulation.step(11000 + tick * FIXED_MILLISECONDS);
    expect(simulation.getSnapshot().tick).toBe(lobbyTick + 3);
    simulation.returnToLobby();
    const previousTick = simulation.getTick();
    simulation.start();
    simulation.step(11100);
    expect(simulation.getSnapshot().tick).toBe(previousTick + 1);
    simulation.dispose();
  });

  it("keeps two to four karts abreast, separated and equally far from the line", () => {
    const simulation = new SimulationSystem();
    const forwardDistances = () => simulation.getSnapshot().players.map((player) =>
      (player.position[0] - FINISH_MARKER.position[0]) * FINISH_MARKER.forward[0] +
      (player.position[2] - FINISH_MARKER.position[1]) * FINISH_MARKER.forward[1]);
    for (let index = 0; index < 4; index += 1) {
      simulation.addPlayer(`p${index}`, `Player ${index}`, PLAYER_COLORS[index]);
      for (const distance of forwardDistances()) {
        expect(distance).toBeCloseTo(-NETWORK_CONFIG.startGrid.distanceBehindLine, 5);
      }
    }
    simulation.start();
    const before = simulation.getSnapshot().players;
    for (let tick = 0; tick < 120; tick += 1) simulation.step(1000 + tick * FIXED_MILLISECONDS);
    const after = simulation.getSnapshot().players;
    after.forEach((player, index) => {
      expect(player.position[0]).toBeCloseTo(before[index].position[0], 4);
      expect(player.position[2]).toBeCloseTo(before[index].position[2], 4);
      expect(player.impactRevision).toBe(0);
      for (const other of after.slice(index + 1)) {
        expect(Math.hypot(player.position[0] - other.position[0], player.position[2] - other.position[2]))
          .toBeGreaterThan(1.6);
      }
    });
    simulation.returnToLobby();
    simulation.removePlayer("p1");
    for (const distance of forwardDistances()) {
      expect(distance).toBeCloseTo(-NETWORK_CONFIG.startGrid.distanceBehindLine, 5);
    }
    simulation.dispose();
  });

  it("advances a fixed authoritative tick and resolves a real kart collision", () => {
    const simulation = new SimulationSystem();
    simulation.addPlayer("driver", "Driver", "coral");
    simulation.addPlayer("idle", "Idle", "sun");
    simulation.start();
    let now = 1_000;
    let sequence = 0;

    for (let tick = 0; tick < NETWORK_CONFIG.simulationRateHz * 12; tick += 1) {
      now += 1_000 / NETWORK_CONFIG.simulationRateHz;
      if (tick % (NETWORK_CONFIG.simulationRateHz / NETWORK_CONFIG.inputRateHz) === 0) {
        simulation.input.receive("driver", {
          sequence,
          sentAt: now,
          input: { throttle: 1, brake: 0, steer: 1, drift: false },
        }, now);
        simulation.input.receive("idle", {
          sequence,
          sentAt: now,
          input: { throttle: 1, brake: 0, steer: -1, drift: false },
        }, now);
        sequence += 1;
      }
      simulation.step(now);
    }

    const snapshot = simulation.getSnapshot(now);
    const driver = snapshot.players.find((player) => player.id === "driver");
    const idle = snapshot.players.find((player) => player.id === "idle");
    expect(snapshot.tick).toBe(NETWORK_CONFIG.simulationRateHz * 12);
    expect(driver?.impactRevision).toBeGreaterThan(0);
    expect(idle?.impactRevision).toBeGreaterThan(0);
    expect(snapshot.protocolVersion).toBe(NETWORK_CONFIG.protocolVersion);
    simulation.dispose();
  });

  it("keeps both drivers in control after a head-on impact without granting item immunity", () => {
    const simulation = new SimulationSystem(1);
    try {
      simulation.addPlayer("left", "Left", "coral");
      simulation.addPlayer("right", "Right", "sun");
      simulation.start();
      let now = 1000;
      while (simulation.getPhase() === "countdown") simulation.step(now += FIXED_MILLISECONDS);
      simulation.resetPlayerPose("left", [-8, KART_START.position[1], -10.5], -Math.PI / 2);
      simulation.resetPlayerPose("right", [8, KART_START.position[1], -10.5], Math.PI / 2);
      let collision = false;
      for (let tick = 0; tick < 180; tick += 1) {
        now += FIXED_MILLISECONDS;
        if (tick % 3 === 0) for (const id of ["left", "right"]) {
          simulation.input.receive(id, { sequence: tick, sentAt: now,
            input: { throttle: 1, brake: 0, steer: 0, drift: false } }, now);
        }
        simulation.step(now);
        const players = simulation.getSnapshot(now).players;
        if (players.some((player) => player.impactRevision > 0)) {
          expect(players.every((player) => player.spinOutRemaining === 0 && player.item.immunityRemaining === 0)).toBe(true);
          collision = true;
          break;
        }
      }
      expect(collision).toBe(true);
      const before = simulation.getSnapshot(now).players.map((player) => player.yaw);
      for (let tick = 0; tick < 30; tick += 1) {
        now += FIXED_MILLISECONDS;
        if (tick % 3 === 0) for (const id of ["left", "right"]) {
          simulation.input.receive(id, { sequence: 1000 + tick, sentAt: now,
            input: { throttle: 0, brake: 1, steer: 1, drift: false } }, now);
        }
        simulation.step(now);
      }
      const after = simulation.getSnapshot(now).players;
      expect(after.every((player) => player.spinOutRemaining === 0 && player.item.immunityRemaining === 0)).toBe(true);
      expect(after.every((player, index) => Math.abs(player.yaw - before[index]) > 0.01)).toBe(true);
    } finally { simulation.dispose(); }
  });

  it("preserves acceleration and displacement while driving along or onto a curb", () => {
    const drive = (z: number, yaw: number, ticks: number) => {
      const simulation = new SimulationSystem();
      try {
        simulation.addPlayer("driver", "Driver", "coral");
        simulation.start();
        let now = 1000;
        for (let tick = 0; tick < 190; tick += 1) simulation.step(now += FIXED_MILLISECONDS);
        simulation.resetPlayerPose("driver", [-10, KART_START.position[1], z], yaw);
        for (let tick = 0; tick < ticks; tick += 1) {
          now += FIXED_MILLISECONDS;
          if (tick % 3 === 0) simulation.input.receive("driver", {
            sequence: tick, sentAt: now,
            input: { throttle: 1, brake: 0, steer: 0, drift: false },
          }, now);
          simulation.step(now);
        }
        return simulation.getSnapshot(now).players[0];
      } finally { simulation.dispose(); }
    };
    for (const scenario of [
      { curbZ: -15.0, roadZ: -10.5, yaw: -Math.PI / 2, ticks: 72 },
      { curbZ: -11.5, roadZ: -9, yaw: -Math.PI / 4, ticks: 42 },
    ]) {
      const road = drive(scenario.roadZ, scenario.yaw, scenario.ticks);
      const curb = drive(scenario.curbZ, scenario.yaw, scenario.ticks);
      expect(curb.speed).toBeCloseTo(road.speed, 2);
      expect(curb.position[0]).toBeCloseTo(road.position[0], 2);
      expect(curb.position[2] - scenario.curbZ).toBeCloseTo(road.position[2] - scenario.roadZ, 2);
      expect(curb.impactRevision).toBe(0);
      expect(curb.spinOutRemaining).toBe(0);
    }
  });

  it("uses the shared visible guard segments as authoritative static colliders", () => {
    const simulation = new SimulationSystem();
    simulation.addPlayer("driver", "Driver", "coral");
    simulation.start();
    let now = 2_000;
    let sequence = 0;

    for (let tick = 0; tick < NETWORK_CONFIG.simulationRateHz * 3.1; tick += 1) {
      now += 1_000 / NETWORK_CONFIG.simulationRateHz;
      simulation.step(now);
    }
    const guard = [...GUARD_RAIL_SEGMENTS].sort((left, right) => {
      const leftDistance = Math.hypot(left.position[0] + 7, left.position[2] + 15);
      const rightDistance = Math.hypot(right.position[0] + 7, right.position[2] + 15);
      return leftDistance - rightDistance;
    })[0];
    simulation.resetPlayerPose(
      "driver",
      [guard.position[0], KART_START.position[1], guard.position[2] + 1.5],
      0,
    );

    for (let tick = 0; tick < NETWORK_CONFIG.simulationRateHz * 1.5; tick += 1) {
      now += 1_000 / NETWORK_CONFIG.simulationRateHz;
      if (tick % (NETWORK_CONFIG.simulationRateHz / NETWORK_CONFIG.inputRateHz) === 0) {
        simulation.input.receive("driver", {
          sequence,
          sentAt: now,
          input: { throttle: 1, brake: 0, steer: 0, drift: false },
        }, now);
        sequence += 1;
      }
      simulation.step(now);
      expect(simulation.getSnapshot(now).players[0].position[2]).toBeGreaterThan(guard.position[2]);
    }

    const player = simulation.getSnapshot(now).players[0];
    expect(player.position[2]).toBeGreaterThan(guard.position[2]);
    // An Arcade impact may spin the kart away; verify contact and no wall crossing.
    expect(player.impactRevision).toBeGreaterThan(0);
    simulation.dispose();
  });

  it("finishes four independent three-lap racers on one authoritative tick", () => {
    const simulation = new SimulationSystem();
    const playerIds = PLAYER_COLORS.map((color, index) => {
      const playerId = `player-${index + 1}`;
      simulation.addPlayer(playerId, `Driver ${index + 1}`, color);
      return playerId;
    });
    simulation.start();
    let now = 3_000;
    const startPositions = simulation.getSnapshot(now).players.map((player) => player.position);
    let sequence = 0;

    for (let tick = 0; tick < NETWORK_CONFIG.simulationRateHz; tick += 1) {
      now += FIXED_MILLISECONDS;
      if (tick % (NETWORK_CONFIG.simulationRateHz / NETWORK_CONFIG.inputRateHz) === 0) {
        simulation.input.receive(playerIds[0], {
          sequence,
          sentAt: now,
          input: { throttle: 1, brake: 0, steer: 1, drift: false },
        }, now);
        sequence += 1;
      }
      simulation.step(now);
    }
    const countdownSnapshot = simulation.getSnapshot(now);
    expect(countdownSnapshot.phase).toBe("countdown");
    expect(countdownSnapshot.players.map((player) => player.position)).toEqual(startPositions);
    expect(countdownSnapshot.players.every((player) => player.speed === 0)).toBe(true);

    while (simulation.getPhase() === "countdown") {
      now += FIXED_MILLISECONDS;
      simulation.step(now);
    }

    for (let lap = 0; lap < 3; lap += 1) {
      for (const marker of [...CHECKPOINTS, FINISH_MARKER]) {
        placeForCrossing(simulation, playerIds, marker, "previous");
        now += FIXED_MILLISECONDS;
        simulation.step(now);
        placeForCrossing(simulation, playerIds, marker, "current");
        now += FIXED_MILLISECONDS;
        simulation.step(now);
      }
    }

    const snapshot = simulation.getSnapshot(now);
    expect(snapshot.phase).toBe("finished");
    expect(snapshot.players).toHaveLength(4);
    expect(snapshot.players.every((player) => player.status === "finished")).toBe(true);
    expect(snapshot.players.every((player) => player.completedLaps === 3)).toBe(true);
    expect(new Set(snapshot.players.map((player) => player.finishTime)).size).toBe(1);
    expect(snapshot.players.map((player) => player.rank)).toEqual([1, 2, 3, 4]);
    simulation.markDnf(playerIds[0]);
    const departedFinisher = simulation.getSnapshot(now).players.find((player) => player.id === playerIds[0]);
    expect(departedFinisher).toMatchObject({ status: "finished", connection: "disconnected", completedLaps: 3 });
    expect(departedFinisher?.finishTime).toBe(snapshot.players[0].finishTime);
    simulation.dispose();
  });

  it("allows the last racer a finish window, preserves connected DNF seats and resets a rematch", () => {
    const simulation = new SimulationSystem(1);
    try {
      simulation.addPlayer("first", "First", "coral");
      simulation.addPlayer("last", "Last", "sun");
      simulation.start();
      let now = 1000;
      while (simulation.getPhase() === "countdown") simulation.step(now += FIXED_MILLISECONDS);
      for (let lap = 0; lap < 3; lap += 1) {
        for (const marker of [...CHECKPOINTS, FINISH_MARKER]) {
          placeForCrossing(simulation, ["first"], marker, "previous");
          simulation.step(now += FIXED_MILLISECONDS);
          placeForCrossing(simulation, ["first"], marker, "current");
          simulation.step(now += FIXED_MILLISECONDS);
        }
      }
      const firstFinish = simulation.getSnapshot(now);
      expect(firstFinish.phase).toBe("racing");
      expect(firstFinish.finishRemaining).toBe(ITEM_CONFIG.finishGraceSeconds);
      expect(firstFinish.players.find((player) => player.id === "first")?.status).toBe("finished");
      for (let tick = 0; tick < ITEM_CONFIG.finishGraceSeconds * NETWORK_CONFIG.simulationRateHz; tick += 1) {
        simulation.step(now += FIXED_MILLISECONDS);
      }
      const result = simulation.getSnapshot(now);
      expect(result.phase).toBe("finished");
      expect(result.players[1]).toMatchObject({ id: "last", status: "dnf", connection: "connected" });
      expect(simulation.useItem("first", 0)).toBe(false);
      expect(simulation.useItem("last", 0)).toBe(false);
      const tick = simulation.getTick();
      simulation.returnToLobby();
      simulation.start();
      expect(simulation.getTick()).toBe(tick);
      expect(simulation.getSnapshot(now).finishRemaining).toBeNull();
      expect(simulation.getSnapshot(now).players.every((player) => player.completedLaps === 0 && player.item.held === null)).toBe(true);
      while (simulation.getPhase() === "countdown") simulation.step(now += FIXED_MILLISECONDS);
      simulation.input.receive("first", { sequence: 1, sentAt: now,
        input: { throttle: 1, brake: 0, steer: 0, drift: false } }, now);
      simulation.step(now += FIXED_MILLISECONDS);
      expect(simulation.getSnapshot(now).players.find((player) => player.id === "first")?.speed).toBeGreaterThan(0);
    } finally { simulation.dispose(); }
  });
});

describe("starting lights launch", () => {
  beforeAll(async () => { await RAPIER.init(); });
  it("holds every kart during red lights and boosts every racer once on green", () => {
    const simulation = new SimulationSystem(42);
    try {
      simulation.addPlayer("a", "A", "coral");
      simulation.addPlayer("b", "B", "sky");
      simulation.start();
      for (let i = 0; i < 175; i++) simulation.step();
      expect(simulation.getPhase()).toBe("countdown");
      expect(simulation.getSnapshot().players.every(p => Math.abs(p.speed) < .01)).toBe(true);
      while (simulation.getPhase() === "countdown") simulation.step();
      for (const player of simulation.getSnapshot().players) {
        expect(player.speed).toBeGreaterThanOrEqual(9.9);
        expect(player.turboTier).toBe(2);
      }
      for (let i = 0; i < 100; i++) simulation.step();
      expect(simulation.getSnapshot().players.every(p => p.turboTier === 0)).toBe(true);
    } finally { simulation.dispose(); }
  });
});
