import { sampleTrackSurface, roadQuaternion, createSurfaceResult } from "../../src/game/track/trackSurface";
import { resolveWallCollision } from "../../src/game/core/collision/collisionSystem";
import RAPIER, { type Collider, type RigidBody } from "@dimforge/rapier3d-compat";
import { EMPTY_KART_INPUT, type KartInput } from "../../src/game/core/kart/kartTypes";
import {
  applyLaunchBoost,
  createInitialKartState,
  getKartForward,
  getKartLateralSpeed,
  stepKartSimulation,
} from "../../src/game/core/kart/kartPhysics";
import { KART_CONFIG, KART_START } from "../../src/game/core/kart/kartConfig";
import {
  createInitialRaceState,
  startRace,
  stepRace,
} from "../../src/game/core/race/raceEngine";
import { FINISH_MARKER } from "../../src/game/core/race/raceTrack";
import { getTrackData, type TrackData } from "../../src/game/track/trackData";
import type { TrackId } from "../../src/game/track/trackCatalog";
import { TRACK_CONFIG } from "../../src/game/track/trackConfig";
import { NETWORK_CONFIG, type PlayerColor } from "../../src/game/network/networkConfig";
import type {
  MultiplayerPhase,
  ParticipantConnection,
  PlayerSnapshot,
  RaceSnapshot,
  ImpactKind,
} from "../../src/game/network/protocol";
import type { ServerPlayerState } from "../state/roomState";
import { getCollisionResponse, getNormalImpactSpeed } from "./CollisionSystem";
import { InputSystem } from "./InputSystem";
import { botInput } from "./BotDriver";
import { BOT_CONFIG } from "./botConfig";
import { rankPlayers } from "./RankingSystem";
import { ItemSystem } from "../../src/game/core/items/ItemSystem";
import { createItemState } from "../../src/game/core/items/ItemEffects";
import { ITEM_CONFIG } from "../../src/game/core/items/itemConfig";
import type { ItemRacer } from "../../src/game/core/items/itemTypes";
import type { Point2 } from "../../src/game/core/race/raceTrack";

type PhysicsPlayer = {
  body: RigidBody;
  collider: Collider;
};

type ColliderTag =
  | Readonly<{ kind: "player"; playerId: string }>
  | Readonly<{ kind: "guard" }>;

const FIXED_DELTA = 1 / NETWORK_CONFIG.simulationRateHz;

function yawRotation(yaw: number, roll = 0) {
  return { x: Math.sin(yaw / 2) * Math.sin(roll / 2), y: Math.sin(yaw / 2) * Math.cos(roll / 2), z: Math.cos(yaw / 2) * Math.sin(roll / 2), w: Math.cos(yaw / 2) * Math.cos(roll / 2) };
}

function gridPose(index: number, playerCount: number, finish = FINISH_MARKER) {
  const lane = index - (playerCount - 1) / 2;
  const backward = NETWORK_CONFIG.startGrid.distanceBehindLine;
  return {
    position: [
      finish.position[0] - finish.forward[0] * backward +
        finish.right[0] * lane * NETWORK_CONFIG.startGrid.laneSpacing,
      KART_START.position[1],
      finish.position[1] - finish.forward[1] * backward +
        finish.right[1] * lane * NETWORK_CONFIG.startGrid.laneSpacing,
    ] as const,
    yaw: finish.respawn.yaw,
  };
}

export class SimulationSystem {
  readonly track: TrackData;
  private readonly surface = createSurfaceResult();
  readonly input = new InputSystem();
  private readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  private readonly eventQueue = new RAPIER.EventQueue(true);
  private readonly players = new Map<string, ServerPlayerState>();
  private readonly physicsPlayers = new Map<string, PhysicsPlayer>();
  private readonly colliderTags = new Map<number, ColliderTag>();
  private phase: MultiplayerPhase = "lobby";
  private tick = 0;
  private readonly items: ItemSystem;
  private readonly previousPositions = new Map<string, Point2>();
  private readonly contactVelocities = new Map<string, { x: number; z: number }>();
  private raceSeed: number;
  private finishDeadlineTick: number | null = null;
  private disposed = false;
  private readonly bots = new Map<string, { lane: number; input: KartInput }>();

  constructor(seed = Math.floor(Math.random() * 0x100000000), trackId: TrackId = "meadow") {
    this.track = getTrackData(trackId);
    this.raceSeed = seed;
    this.items = new ItemSystem(seed, this.track.items, this.track.geometry.GUARD_RAIL_SEGMENTS);
    this.world.timestep = FIXED_DELTA;
    this.createStaticTrack();
  }

  addPlayer(id: string, nickname: string, color: PlayerColor, botLane?: number) {
    if (this.players.has(id)) {
      return;
    }
    const pose = gridPose(this.players.size, this.players.size + 1, this.track.race.FINISH_MARKER);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...pose.position)
        .setRotation(yawRotation(pose.yaw))
        .setGravityScale(1)
        .setCanSleep(false)
        .setSoftCcdPrediction(KART_CONFIG.softCcdPrediction)
        .enabledTranslations(true, true, true)
        .lockRotations(),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(NETWORK_CONFIG.collision.colliderHalfWidth * KART_CONFIG.modelScale, 0.3, 0.9 * KART_CONFIG.modelScale, 0.12 * KART_CONFIG.modelScale)
        .setDensity(1.1)
        .setFriction(0.25)
        .setRestitution(0.18)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    this.colliderTags.set(collider.handle, { kind: "player", playerId: id });
    this.physicsPlayers.set(id, { body, collider });
    this.players.set(id, {
      id,
      nickname,
      color,
      connection: "connected",
      status: "waiting",
      kart: createInitialKartState(pose.yaw),
      race: createInitialRaceState(),
      lateralSpeed: 0,
      wallReboundRemaining: 0,
      spinOutRemaining: 0,
      impactRevision: 0,
      impactKind: "kart",
      collisionCooldown: 0,
      rank: this.players.size + 1,
    });
    this.input.addPlayer(id);
    if (botLane !== undefined) this.bots.set(id, { lane: botLane, input: EMPTY_KART_INPUT });
    this.items.addPlayer(id);
    this.contactVelocities.set(id, { x: 0, z: 0 });
    this.repositionGrid();
  }

  removePlayer(id: string) {
    const physics = this.physicsPlayers.get(id);
    if (physics) {
      this.colliderTags.delete(physics.collider.handle);
      this.world.removeRigidBody(physics.body);
    }
    this.physicsPlayers.delete(id);
    this.players.delete(id);
    this.input.removePlayer(id);
    this.bots.delete(id);
    this.items.removePlayer(id);
    this.previousPositions.delete(id);
    this.contactVelocities.delete(id);
    this.repositionGrid();
  }

  setConnection(id: string, connection: ParticipantConnection) {
    const player = this.players.get(id);
    if (player) {
      player.connection = connection;
      if (connection !== "connected") {
        this.input.neutralize(id);
        this.items.clearPlayer(id, this.tick, this.itemRacer(player).position);
      }
    }
  }

  markDnf(id: string) {
    const player = this.players.get(id);
    const physics = this.physicsPlayers.get(id);
    if (!player || this.phase === "lobby") {
      return;
    }
    player.connection = "disconnected";
    // Leaving after crossing the finish line cannot revoke an authoritative result.
    if (player.status !== "finished") player.status = "dnf";
    this.items.clearPlayer(id, this.tick, this.itemRacer(player).position);
    player.kart = createInitialKartState(player.kart.yaw);
    physics?.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    physics?.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    physics?.collider.setSensor(true);
    this.finishIfComplete();
  }

  start() {
    if (this.phase !== "lobby") {
      return false;
    }
    this.phase = "countdown";
    this.finishDeadlineTick = null;
    this.items.reset(this.raceSeed++);
    // Room-wide sequence must remain monotonic for broadcast scheduling and snapshot ordering.
    this.players.forEach((player, id) => {
      const index = [...this.players.keys()].indexOf(id);
      const pose = gridPose(index, this.players.size, this.track.race.FINISH_MARKER);
      const physics = this.physicsPlayers.get(id);
      player.status = "racing";
      player.kart = createInitialKartState(pose.yaw);
      player.race = startRace(createInitialRaceState()).state;
      player.lateralSpeed = 0;
      player.wallReboundRemaining = 0;
      player.spinOutRemaining = 0;
      player.impactRevision = 0;
      player.collisionCooldown = 0;
      if (physics) {
        physics.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        physics.collider.setSensor(false);
        physics.body.setTranslation(
          { x: pose.position[0], y: pose.position[1], z: pose.position[2] },
          true,
        );
        physics.body.setRotation(yawRotation(pose.yaw), true);
        physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      this.input.neutralize(id);
      const bot = this.bots.get(id);
      if (bot) bot.input = EMPTY_KART_INPUT;
    });
    rankPlayers([...this.players.values()]);
    return true;
  }

  returnToLobby() {
    this.phase = "lobby";
    this.finishDeadlineTick = null;
    this.items.reset(this.raceSeed);
    this.players.forEach((player) => {
      player.status = "waiting";
      player.race = createInitialRaceState();
      player.spinOutRemaining = 0;
      this.input.neutralize(player.id);
    });
    this.repositionGrid();
  }

  step(now = Date.now()) {
    if (this.disposed) return;
    this.tick += 1;
    for (const player of this.players.values()) {
      this.previousPositions.set(player.id, this.itemRacer(player).position);
      this.preparePlayerStep(player, now);
    }

    this.world.step(this.eventQueue);
    this.processCollisions();

    for (const player of this.players.values()) {
      this.finishPlayerStep(player, now);
    }
    this.items.step(FIXED_DELTA, [...this.players.values()].map((player) => this.itemRacer(player)), this.tick);
    for (const event of this.items.snapshot().events) {
      if (event.tick !== this.tick || event.kind !== "hit") continue;
      const player = this.players.get(event.playerId);
      const physics = this.physicsPlayers.get(event.playerId);
      if (!player || !physics) continue;
      player.kart = createInitialKartState(player.kart.yaw);
      player.lateralSpeed = 0;
      player.wallReboundRemaining = 0;
      player.spinOutRemaining = ITEM_CONFIG.hitLockSeconds;
      player.impactRevision += 1;
      player.impactKind = "item";
      physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    rankPlayers([...this.players.values()]);
    this.finishIfComplete();
  }

  getSnapshot(now = Date.now()): RaceSnapshot {
    const ordered = [...this.players.values()].sort((left, right) => left.rank - right.rank);
    const lead = ordered.find((player) => player.status === "racing") ?? ordered[0];
    return {
      trackId: this.track.id,
      protocolVersion: NETWORK_CONFIG.protocolVersion,
      tick: this.tick,
      serverTime: now,
      phase: this.phase,
      countdownRemaining: this.phase === "countdown" ? (lead?.race.countdownRemaining ?? 0) : 0,
      elapsedTime: Math.max(0, ...ordered.map((player) => player.race.elapsedTime)),
      players: ordered.map((player) => this.playerSnapshot(player, now)),
      items: this.items.snapshot(),
      finishRemaining: this.finishDeadlineTick === null ? null
        : Math.max(0, (this.finishDeadlineTick - this.tick) / NETWORK_CONFIG.simulationRateHz),
    };
  }

  getPhase() {
    return this.phase;
  }

  useItem(id: string, revision: number) {
    const player = this.players.get(id);
    return player && player.spinOutRemaining === 0 ? this.items.use(this.itemRacer(player), revision, this.tick,
      [...this.players.values()].map((candidate) => this.itemRacer(candidate))) : false;
  }

  private itemRacer(player: ServerPlayerState): ItemRacer {
    const translation = this.physicsPlayers.get(player.id)?.body.translation();
    const position: Point2 = [translation?.x ?? 0, translation?.z ?? 0];
    return { id: player.id, position, previousPosition: this.previousPositions.get(player.id) ?? position,
      yaw: player.kart.yaw, eligible: this.phase === "racing" && player.status === "racing" &&
        player.connection === "connected" && player.race.respawn.protectionRemaining === 0 };
  }

  getTick() {
    return this.tick;
  }

  getPlayerCount() {
    return this.players.size;
  }

  resetPlayerPose(id: string, position: readonly [number, number, number], yaw: number) {
    const player = this.players.get(id);
    const physics = this.physicsPlayers.get(id);
    if (!player || !physics) {
      return false;
    }
    player.kart = createInitialKartState(yaw);
    player.lateralSpeed = 0;
      player.wallReboundRemaining = 0;
    physics.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    physics.body.setRotation(yawRotation(yaw), true);
    physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const id of this.players.keys()) { this.input.removePlayer(id); this.items.removePlayer(id); }
    this.players.clear();
    this.physicsPlayers.clear();
    this.colliderTags.clear();
    this.previousPositions.clear();
    this.contactVelocities.clear();
    this.bots.clear();
    this.eventQueue.free();
    this.world.free();
  }

  private preparePlayerStep(player: ServerPlayerState, now: number) {
    const physics = this.physicsPlayers.get(player.id);
    if (!physics) {
      return;
    }
    player.wallReboundRemaining = Math.max(0, player.wallReboundRemaining - FIXED_DELTA);
    player.collisionCooldown = Math.max(0, player.collisionCooldown - FIXED_DELTA);
    player.spinOutRemaining = Math.max(0, player.spinOutRemaining - FIXED_DELTA);

    const item = this.items.getPlayer(player.id);
    const canDrive = this.phase === "racing" && player.status === "racing" &&
      player.connection === "connected" && player.spinOutRemaining === 0 &&
      (item?.lockRemaining ?? 0) === 0 && player.race.respawn.protectionRemaining === 0;
    const bot = this.bots.get(player.id);
    const position = physics.body.translation();
    const input = canDrive ? (!bot ? this.input.read(player.id, now)
      : botInput(position.x, position.z, player.kart.yaw, player.kart.speed, bot.lane,
        [...this.players.values()].flatMap((other) => {
          const point = this.physicsPlayers.get(other.id)?.body.translation();
          return point && other.id !== player.id && other.status === "racing"
            ? [{ x: point.x, z: point.z, speed: other.kart.speed }] : [];
        }), this.track.race.RACE_ROUTE_SAMPLES, !item?.held ? this.items.availableBoxes() : [])) : EMPTY_KART_INPUT;
    if (bot) bot.input = input;
    if (canDrive && bot && item?.held && this.tick % BOT_CONFIG.itemIntervalTicks === 0) {
      this.useItem(player.id, item.revision);
    }
    const boost = canDrive && (item?.boostRemaining ?? 0) > 0
      ? { acceleration: ITEM_CONFIG.boostAcceleration, maximumSpeed: ITEM_CONFIG.boostMaximumSpeed } : undefined;
    const next = stepKartSimulation(player.kart, input, FIXED_DELTA, boost).state;
    player.kart = player.spinOutRemaining > 0
      ? { ...next, yaw: next.yaw + FIXED_DELTA * 8.5 }
      : next;
    player.lateralSpeed = player.wallReboundRemaining > 0 ? player.lateralSpeed * Math.exp(-3 * FIXED_DELTA) : getKartLateralSpeed(
      player.lateralSpeed,
      player.kart.speed,
      input.steer,
      player.kart.drift.active,
      FIXED_DELTA,
    );

    const forward = getKartForward(player.kart.yaw);
    const right = { x: forward.z, z: -forward.x };
    const surface = this.constrainToRoad(physics.body);
    physics.body.setRotation(surface ? roadQuaternion(player.kart.yaw, surface) : yawRotation(player.kart.yaw), true);
    const vx = forward.x * player.kart.speed + right.x * player.lateralSpeed;
    const vz = forward.z * player.kart.speed + right.z * player.lateralSpeed;
    physics.body.setLinvel(
      {
        x: vx,
        y: surface ? vx * surface.gradientX + vz * surface.gradientZ : physics.body.linvel().y,
        z: vz,
      },
      true,
    );
    const contactVelocity = this.contactVelocities.get(player.id);
    if (contactVelocity) {
      const velocity = physics.body.linvel();
      contactVelocity.x = velocity.x;
      contactVelocity.z = velocity.z;
    }
  }

  private constrainToRoad(body: RigidBody) {
    const position = body.translation();
    const surface = sampleTrackSurface(position.x, position.z, this.track.samples, this.surface);
    const target = surface.height + KART_START.position[1];
    if (surface.distance > TRACK_CONFIG.roadWidth / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap || Math.abs(position.y - target) > 2) return null;
    body.setTranslation({ x: position.x, y: target, z: position.z }, true);
    return surface;
  }

  private finishPlayerStep(player: ServerPlayerState, now: number) {
    const physics = this.physicsPlayers.get(player.id);
    if (!physics) {
      return;
    }
    this.constrainToRoad(physics.body);
    const velocity = physics.body.linvel();
    const forward = getKartForward(player.kart.yaw);
    player.kart = {
      ...player.kart,
      speed: velocity.x * forward.x + velocity.z * forward.z,
    };

    if (player.status !== "racing") {
      return;
    }
    const position = physics.body.translation();
    const result = stepRace(
      player.race,
      {
        position: [position.x, position.y, position.z],
        signedSpeed: player.kart.speed,
        throttle: (this.bots.get(player.id)?.input ?? this.input.read(player.id, now)).throttle,
        upY: 1,
      },
      FIXED_DELTA,
      this.track.race,
    );
    if (player.race.phase === "COUNTDOWN" && result.state.phase === "RACING" && player.connection === "connected") {
      player.kart = applyLaunchBoost(player.kart);
    }
    player.race = result.state;
    if (this.phase === "countdown" && result.state.phase === "RACING") {
      this.phase = "racing";
    }
    if (result.state.phase === "FINISHED") {
      player.status = "finished";
      this.items.clearPlayer(player.id, this.tick, [position.x, position.z]);
      player.kart = createInitialKartState(player.kart.yaw);
      physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      physics.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
      physics.collider.setSensor(true);
      this.finishDeadlineTick ??= this.tick + ITEM_CONFIG.finishGraceSeconds * NETWORK_CONFIG.simulationRateHz;
    }
    if (result.respawn) {
      const pose = result.respawn.pose;
      const point: Point2 = [pose.position[0], pose.position[2]];
      this.items.clearPlayer(player.id, this.tick, point, true);
      this.previousPositions.set(player.id, point);
      player.kart = createInitialKartState(pose.yaw);
      player.lateralSpeed = 0;
      player.wallReboundRemaining = 0;
      player.spinOutRemaining = 0;
      physics.body.setTranslation(
        { x: pose.position[0], y: pose.position[1], z: pose.position[2] },
        true,
      );
      physics.body.setRotation(yawRotation(pose.yaw), true);
      physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  private processCollisions() {
    this.eventQueue.drainCollisionEvents((first, second, started) => {
      if (!started) {
        return;
      }
      const firstTag = this.colliderTags.get(first);
      const secondTag = this.colliderTags.get(second);
      if (!firstTag || !secondTag) {
        return;
      }
      if (firstTag.kind === "player" && secondTag.kind === "player") {
        const firstPlayer = this.players.get(firstTag.playerId);
        const secondPlayer = this.players.get(secondTag.playerId);
        const firstPhysics = this.physicsPlayers.get(firstTag.playerId);
        const secondPhysics = this.physicsPlayers.get(secondTag.playerId);
        if (!firstPlayer || !secondPlayer || !firstPhysics || !secondPhysics) {
          return;
        }
        // Classify the approach speed, before Rapier's solver removes the impact velocity.
        const firstVelocity = this.contactVelocities.get(firstPlayer.id) ?? firstPhysics.body.linvel();
        const secondVelocity = this.contactVelocities.get(secondPlayer.id) ?? secondPhysics.body.linvel();
        const relativeSpeed = this.contactApproachSpeed(first, second,
          firstVelocity.x - secondVelocity.x,
          firstVelocity.z - secondVelocity.z,
        );
        this.applyImpact(firstPlayer, relativeSpeed, "kart");
        this.applyImpact(secondPlayer, relativeSpeed, "kart");
        return;
      }
      const playerTag = firstTag.kind === "player" ? firstTag : secondTag.kind === "player" ? secondTag : null;
      const guardTag = firstTag.kind === "guard" ? firstTag : secondTag.kind === "guard" ? secondTag : null;
      if (playerTag && guardTag) {
        const player = this.players.get(playerTag.playerId);
        const physics = this.physicsPlayers.get(playerTag.playerId);
        if (player && physics) {
          const velocity = this.contactVelocities.get(player.id) ?? physics.body.linvel();
          if (player.collisionCooldown > 0 || player.status !== "racing" || player.race.respawn.protectionRemaining > 0) return;
          let normal = { x: 0, z: 0 };
          let strongest = 0;
          this.world.contactPair(this.world.getCollider(first), this.world.getCollider(second), (manifold) => {
            const candidate = manifold.normal();
            const approach = getNormalImpactSpeed(velocity.x, velocity.z, candidate);
            if (approach > strongest) { strongest = approach; normal = { x: candidate.x, z: candidate.z }; }
          });
          const rebound = resolveWallCollision({ velocity, normal, time: this.tick * FIXED_DELTA, lastReactionTime: -Infinity });
          if (!rebound.reacted) return;
          physics.body.setLinvel({ ...rebound.velocity, y: physics.body.linvel().y }, true);
          const forward = getKartForward(player.kart.yaw);
          player.lateralSpeed = rebound.velocity.x * forward.z - rebound.velocity.z * forward.x;
          player.wallReboundRemaining = KART_CONFIG.collision.reboundSeconds;
          player.impactRevision += 1;
          player.impactKind = "wall";
          player.collisionCooldown = KART_CONFIG.collision.cooldown;
        }
      }
    });
  }

  private applyImpact(player: ServerPlayerState, relativeSpeed: number, kind: ImpactKind) {
    if (player.collisionCooldown > 0 || player.status !== "racing" ||
      player.race.respawn.protectionRemaining > 0 || (this.items.getPlayer(player.id)?.immunityRemaining ?? 0) > 0) {
      return;
    }
    const response = getCollisionResponse(relativeSpeed);
    const body = this.physicsPlayers.get(player.id)?.body;
    if (body) {
      // Retain Rapier's push-apart direction and apply damping to its resolved velocity.
      // finishPlayerStep reads this velocity back into the Arcade state.
      const velocity = body.linvel();
      body.setLinvel({
        x: velocity.x * response.speedRetention,
        y: velocity.y,
        z: velocity.z * response.speedRetention,
      }, true);
      player.lateralSpeed *= response.speedRetention;
    }
    // Ordinary contact pushes and slows the kart without taking away steering.
    // Only item hits set spinOutRemaining and grant item recovery protection.
    player.impactRevision += 1;
    player.impactKind = kind;
    player.collisionCooldown = NETWORK_CONFIG.collision.eventCooldownSeconds;
  }

  private contactApproachSpeed(first: number, second: number, x: number, z: number) {
    const firstCollider = this.world.getCollider(first);
    const secondCollider = this.world.getCollider(second);
    if (!firstCollider || !secondCollider) return 0;
    let speed = 0;
    this.world.contactPair(firstCollider, secondCollider, (manifold) => {
      speed = Math.max(speed, getNormalImpactSpeed(x, z, manifold.normal()));
    });
    return speed;
  }

  private finishIfComplete() {
    if (this.phase === "lobby" || this.phase === "finished" || this.players.size === 0) {
      return;
    }
    if (this.finishDeadlineTick !== null && this.tick >= this.finishDeadlineTick) {
      for (const player of this.players.values()) {
        if (player.status !== "racing") continue;
        player.status = "dnf";
        player.kart = createInitialKartState(player.kart.yaw);
        player.spinOutRemaining = 0;
        this.input.neutralize(player.id);
        this.items.clearPlayer(player.id, this.tick, this.itemRacer(player).position);
        const physics = this.physicsPlayers.get(player.id);
        physics?.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        physics?.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        physics?.collider.setSensor(true);
      }
      rankPlayers([...this.players.values()]);
    }
    const complete = [...this.players.values()].every(
      (player) => player.status === "finished" || player.status === "dnf",
    );
    if (complete) {
      this.phase = "finished";
    }
  }

  private playerSnapshot(player: ServerPlayerState, now: number): PlayerSnapshot {
    const physics = this.physicsPlayers.get(player.id);
    const position = physics?.body.translation() ?? { x: 0, y: KART_START.position[1], z: 0 };
    const input = this.bots.get(player.id)?.input ?? this.input.read(player.id, now);
    return {
      id: player.id,
      nickname: player.nickname,
      color: player.color,
      connection: player.connection,
      status: player.status,
      position: [position.x, position.y, position.z],
      yaw: player.kart.yaw,
      speed: player.kart.speed,
      steer: input.steer,
      drifting: player.kart.drift.active,
      driftTier: player.kart.drift.chargeTier,
      turboTier: player.kart.drift.turboTier,
      spinOutRemaining: player.spinOutRemaining,
      impactRevision: player.impactRevision,
      impactKind: player.impactKind,
      completedLaps: player.race.completedLaps,
      totalLaps: player.race.totalLaps,
      checkpointIndex: player.race.expectedCheckpointIndex,
      raceFraction: player.race.progress.raceFraction,
      rank: player.rank,
      finishTime: player.race.finishTime,
      item: this.items.getPlayer(player.id) ?? createItemState(),
    };
  }

  private repositionGrid() {
    [...this.players.values()].forEach((player, index) => {
      const pose = gridPose(index, this.players.size, this.track.race.FINISH_MARKER);
      const physics = this.physicsPlayers.get(player.id);
      player.kart = createInitialKartState(pose.yaw);
      player.lateralSpeed = 0;
      player.wallReboundRemaining = 0;
      player.rank = index + 1;
      physics?.body.setTranslation(
        { x: pose.position[0], y: pose.position[1], z: pose.position[2] },
        true,
      );
      physics?.body.setRotation(yawRotation(pose.yaw), true);
      physics?.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    });
  }

  private createStaticTrack() {
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        TRACK_CONFIG.ground.width / 2,
        TRACK_CONFIG.ground.thickness / 2,
        TRACK_CONFIG.ground.depth / 2,
      ).setTranslation(0, -TRACK_CONFIG.ground.thickness / 2, 0),
      ground,
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(this.track.geometry.DRIVABLE_MESH_DATA.vertices, this.track.geometry.DRIVABLE_MESH_DATA.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setFriction(0),
      ground,
    );
    // Cars are constrained to a fixed height here. Raised curb faces would stop
    // them like walls; curbs remain visual, while the outer guards stay solid.

    for (const segment of this.track.geometry.GUARD_RAIL_SEGMENTS) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(...segment.position)
          .setRotation(yawRotation(segment.rotationY, segment.rotationZ)),
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          segment.size[0] / 2,
          segment.size[1] / 2,
          segment.size[2] / 2,
        )
          .setFriction(0.18)
          .setRestitution(0.12)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      this.colliderTags.set(collider.handle, { kind: "guard" });
    }
  }
}
