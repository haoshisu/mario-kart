import { DEFAULT_CHARACTER, type CharacterId } from "../../src/game/entities/characters";
import { createBridgeState, stepBridge } from "../../src/game/systems/rotatingBridge";
import { bridgeOccupied } from "../../src/game/track/taiwanBridge";
import { courseHandling } from "../../src/game/track/courseDesign";
import { createParkObstacle, parkObstaclePose, parkObstacleYaw, type ParkObstacle } from "../../src/game/track/parkObstacle";
import { sampleDrivingSurface } from "../../src/game/track/drivingSurface";
import { createStuntState, stepStuntLaunch, finishStunt, stuntProgress, applyStuntBoost, applyRampSurface, updateStuntTrick, STUNT_CONFIG } from "../../src/game/core/stunts/stuntSystem";
import { roadQuaternion, createSurfaceResult } from "../../src/game/track/trackSurface";
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
import { getDriftSteering } from "../../src/game/core/kart/driftSystem";
import {
  createInitialRaceState,
  startRace,
  stepRace,
} from "../../src/game/core/race/raceEngine";
import { FINISH_MARKER, type RaceRouteSample } from "../../src/game/core/race/raceTrack";
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
import { resolveKartCollision, getNormalImpactSpeed } from "./CollisionSystem";
import { InputSystem } from "./InputSystem";
import { botInput } from "./BotDriver";
import { BOT_CONFIG } from "./botConfig";
import { SlipstreamSystem } from "./SlipstreamSystem";
import { createSlipstreamState, interruptSlipstream, slipstreamSnapshot, SLIPSTREAM_CONFIG } from "../../src/game/core/kart/slipstreamSystem";
import { rankPlayers } from "./RankingSystem";
import { ItemSystem } from "../../src/game/core/items/ItemSystem";
import { createItemState } from "../../src/game/core/items/ItemEffects";
import { ITEM_CONFIG } from "../../src/game/core/items/itemConfig";
import type { ItemRacer } from "../../src/game/core/items/itemTypes";
import type { Point2 } from "../../src/game/core/race/raceTrack";

type PhysicsPlayer = {
  body: RigidBody;
  collider: Collider;
  contactCollider: Collider;
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
  private readonly slipstreams = new SlipstreamSystem();
  private readonly bridgeState = createBridgeState();
  private bridgeBody: RigidBody | null = null;
  private bridgeGates: RigidBody[] = [];
  private parkObstacle: { body: RigidBody; definition: ParkObstacle } | null = null;
  private obstaclePose = { x: 0, y: 0, z: 0 };
  readonly track: TrackData;
  private readonly surface = createSurfaceResult();
  private readonly botBranches: readonly (readonly RaceRouteSample[])[];
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
    this.botBranches = this.track.branches.map(branch => {
      const main = this.track.race.RACE_ROUTE_SAMPLES;
      const exit = Math.round(branch.exitProgress * main.length);
      return [...branch.samples.map((sample, i) => ({ ...sample, distance: i, raceProgress: branch.entryProgress + sample.progress * (branch.exitProgress - branch.entryProgress) })),
        ...Array.from({ length: 24 }, (_, i) => main[(exit + i + 1) % main.length])];
    });
    this.items = new ItemSystem(seed, this.track.items, [...this.track.geometry.GUARD_RAIL_SEGMENTS, ...this.track.branches.flatMap(branch => branch.geometry.GUARD_RAIL_SEGMENTS)],
      (x, z, height) => sampleDrivingSurface(x, z, this.track, undefined, height, this.bridgeState.locked).height);
    this.world.timestep = FIXED_DELTA;
    this.createStaticTrack();
    this.world.forEachCollider(collider => collider.setCollisionGroups(NETWORK_CONFIG.collision.groups.road));
  }

  addPlayer(id: string, nickname: string, color: PlayerColor, botLane?: number, characterId: CharacterId = DEFAULT_CHARACTER) {
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
      RAPIER.ColliderDesc.roundCuboid(NETWORK_CONFIG.collision.roadColliderHalfWidth * KART_CONFIG.modelScale, 0.3, 0.9 * KART_CONFIG.modelScale, 0.12 * KART_CONFIG.modelScale)
        .setTranslation(0, KART_CONFIG.grounding.colliderLift, 0)
        .setCollisionGroups(NETWORK_CONFIG.collision.groups.roadKart)
        .setDensity(1.1)
        .setFriction(0.25)
        .setRestitution(0.18)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    // Tyres participate in kart-to-kart contact; the road shape preserves the
    // clearance already validated at curved uphill seams and narrow guards.
    const contactCollider = this.world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(NETWORK_CONFIG.collision.colliderHalfWidth * KART_CONFIG.modelScale, 0.3, 0.9 * KART_CONFIG.modelScale, 0.12 * KART_CONFIG.modelScale)
        .setTranslation(0, KART_CONFIG.grounding.colliderLift, 0)
        .setCollisionGroups(NETWORK_CONFIG.collision.groups.kartContact)
        .setDensity(0)
        .setFriction(0)
        .setRestitution(0.18), body,
    );
    this.colliderTags.set(collider.handle, { kind: "player", playerId: id });
    this.physicsPlayers.set(id, { body, collider, contactCollider });
    this.players.set(id, {
      id,
      nickname,
      color,
      characterId,
      connection: "connected",
      status: "waiting",
      kart: createInitialKartState(pose.yaw),
      slipstream: createSlipstreamState(),
      race: createInitialRaceState(),
      lateralSpeed: 0,
      wallReboundRemaining: 0,
      spinOutRemaining: 0,
      stunt: createStuntState(this.track.id === "taipei"),
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
    this.slipstreams.remove(id);
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
        this.slipstreams.remove(id);
        player.slipstream = createSlipstreamState();
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
    this.slipstreams.remove(id);
    player.slipstream = createSlipstreamState();
    // Leaving after crossing the finish line cannot revoke an authoritative result.
    if (player.status !== "finished") player.status = "dnf";
    this.items.clearPlayer(id, this.tick, this.itemRacer(player).position);
    player.stunt = createStuntState(this.track.id === "taipei");
    player.kart = createInitialKartState(player.kart.yaw);
    physics?.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    physics?.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    physics?.collider.setSensor(true);
    physics?.contactCollider.setSensor(true);
    this.finishIfComplete();
  }

  start() {
    if (this.phase !== "lobby") {
      return false;
    }
    this.phase = "countdown";
    this.finishDeadlineTick = null;
    this.items.reset(this.raceSeed++);
    this.slipstreams.reset();
    // Room-wide sequence must remain monotonic for broadcast scheduling and snapshot ordering.
    this.players.forEach((player, id) => {
      const index = [...this.players.keys()].indexOf(id);
      const pose = gridPose(index, this.players.size, this.track.race.FINISH_MARKER);
      const physics = this.physicsPlayers.get(id);
      player.status = "racing";
      player.stunt = createStuntState(this.track.id === "taipei");
      player.kart = createInitialKartState(pose.yaw);
      player.slipstream = createSlipstreamState();
      player.race = startRace(createInitialRaceState()).state;
      player.lateralSpeed = 0;
      player.wallReboundRemaining = 0;
      player.spinOutRemaining = 0;
      player.impactRevision = 0;
      player.collisionCooldown = 0;
      if (physics) {
        physics.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        physics.collider.setSensor(false);
        physics.contactCollider.setSensor(false);
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
    this.slipstreams.reset();
    this.players.forEach((player) => {
      player.status = "waiting";
      player.slipstream = createSlipstreamState();
      player.race = createInitialRaceState();
      player.spinOutRemaining = 0;
      this.input.neutralize(player.id);
    });
    this.repositionGrid();
  }

  step(now = Date.now()) {
    if (this.disposed) return;
    this.tick += 1;
    const bridge = this.track.bridge;
    if (bridge && this.bridgeBody) {
      let occupied = false;
      for (const player of this.players.values()) {
        const body = this.physicsPlayers.get(player.id)?.body;
        if (!body || player.status !== "racing") continue;
        const p = body.translation();
        occupied ||= bridgeOccupied(bridge.branch,p.x,p.y-.52,p.z);
      }
      stepBridge(this.bridgeState,FIXED_DELTA,occupied);
      this.bridgeBody.setNextKinematicRotation(yawRotation(this.bridgeState.angle));
      this.bridgeGates.forEach((body,i)=>body.setNextKinematicTranslation({x:bridge.gates[i].position[0],y:bridge.gates[i].position[1]+this.bridgeState.gateHeight,z:bridge.gates[i].position[2]}));
    }
    if (this.parkObstacle) {
      this.parkObstacle.body.setNextKinematicTranslation(parkObstaclePose(this.parkObstacle.definition, this.tick * FIXED_DELTA, this.obstaclePose));
      this.parkObstacle.body.setNextKinematicRotation(yawRotation(parkObstacleYaw(this.parkObstacle.definition, this.tick * FIXED_DELTA)));
    }
    for (const player of this.players.values()) {
      this.previousPositions.set(player.id, this.itemRacer(player).position);
      this.preparePlayerStep(player, now);
    }

    this.world.step(this.eventQueue);
    this.processCollisions();

    for (const player of this.players.values()) {
      this.finishPlayerStep(player, now);
    }
    this.slipstreams.step(this.world, this.players.values(), FIXED_DELTA);
    this.items.step(FIXED_DELTA, [...this.players.values()].map((player) => this.itemRacer(player)), this.tick);
    for (const event of this.items.snapshot().events) {
      if (event.tick !== this.tick || event.kind !== "hit") continue;
      const player = this.players.get(event.playerId);
      const physics = this.physicsPlayers.get(event.playerId);
      if (!player || !physics) continue;
      player.stunt = createStuntState(this.track.id === "taipei");
      player.kart = createInitialKartState(player.kart.yaw);
      player.lateralSpeed = 0;
      player.wallReboundRemaining = 0;
      player.spinOutRemaining = ITEM_CONFIG.hitLockSeconds;
      player.impactRevision += 1;
      player.impactKind = "item";
      interruptSlipstream(player.slipstream);
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
      bridge: this.track.bridge ? { ...this.bridgeState } : undefined,
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
    return { id: player.id, position, height: (translation?.y ?? KART_START.position[1]) - KART_START.position[1], previousPosition: this.previousPositions.get(player.id) ?? position,
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
    player.stunt = createStuntState(this.track.id === "taipei");
    player.kart = createInitialKartState(yaw);
    player.slipstream = createSlipstreamState();
    this.slipstreams.remove(id);
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
    this.slipstreams.reset();
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
    const activeRoad = sampleDrivingSurface(position.x, position.z, this.track, this.surface, position.y - KART_START.position[1], this.bridgeState.locked).routeIndex ?? 0;
    const handling = courseHandling(this.track.id, this.surface, canDrive && !player.stunt.active && Math.abs(position.y - this.surface.height - KART_START.position[1]) < .8, player.kart.yaw, this.tick * FIXED_DELTA);
    const botRoute = activeRoad > 0 ? this.botBranches[activeRoad - 1] : this.track.race.RACE_ROUTE_SAMPLES;
    const input = canDrive ? (!bot ? this.input.read(player.id, now)
      : botInput(position.x, position.z, player.kart.yaw, player.kart.speed, bot.lane,
        [...this.players.values()].flatMap((other) => {
          const point = this.physicsPlayers.get(other.id)?.body.translation();
          return point && other.id !== player.id && other.status === "racing"
            ? [{ x: point.x, z: point.z, speed: other.kart.speed }] : [];
        }), botRoute, !item?.held ? this.items.availableBoxes() : [], position.y - KART_START.position[1], this.track.id === "taipei" ? player.kart.drift : undefined,
        this.slipstreams.pursuit(this.world, player))) : EMPTY_KART_INPUT;
    if (bot) bot.input = input;
    if (canDrive && bot && item?.held && this.tick % BOT_CONFIG.itemIntervalTicks === 0) {
      this.useItem(player.id, item.revision);
    }
    const boostingItem = canDrive && (item?.boostRemaining ?? 0) > 0;
    const boostingDraft = canDrive && input.brake === 0 && player.slipstream.boostRemaining > 0;
    const boost = boostingItem || boostingDraft ? {
      acceleration: Math.max(boostingItem ? ITEM_CONFIG.boostAcceleration : 0, boostingDraft ? SLIPSTREAM_CONFIG.boostAcceleration : 0),
      maximumSpeed: Math.max(boostingItem ? ITEM_CONFIG.boostMaximumSpeed : 0, boostingDraft ? SLIPSTREAM_CONFIG.boostMaximumSpeed : 0),
    } : undefined;
    const airInput = player.stunt.active ? { ...input, drift: false, steer: input.steer * STUNT_CONFIG.airSteering } : input;
    updateStuntTrick(player.stunt, input.drift, canDrive, FIXED_DELTA);
    if (player.stunt.active) player.kart = { ...player.kart, drift: { ...player.kart.drift, active:false, direction:0, charge:0, chargeTier:0 } };
    const next = stepKartSimulation(player.kart, airInput, FIXED_DELTA, boost, handling).state;
    player.kart = player.spinOutRemaining > 0
      ? { ...next, yaw: next.yaw + FIXED_DELTA * 8.5 }
      : next;
    player.lateralSpeed = player.wallReboundRemaining > 0 ? player.lateralSpeed * Math.exp(-3 * FIXED_DELTA) : getKartLateralSpeed(
      player.lateralSpeed,
      player.kart.speed,
      getDriftSteering(player.kart.drift, input.steer),
      player.kart.drift.active,
      FIXED_DELTA,
      handling,
    );

    const forward = getKartForward(player.kart.yaw);
    const right = { x: -forward.z, z: forward.x };
    const launched = stepStuntLaunch(player.stunt, position.x, position.y, position.z,
      player.kart.yaw, player.kart.speed, this.track.ramps, canDrive, FIXED_DELTA);
    const surface = player.stunt.active ? null : this.constrainToRoad(physics.body);
    physics.body.setRotation(surface ? roadQuaternion(player.kart.yaw, surface) : yawRotation(player.kart.yaw), true);
    const vx = forward.x * player.kart.speed + right.x * player.lateralSpeed;
    const vz = forward.z * player.kart.speed + right.z * player.lateralSpeed;
    physics.body.setLinvel(
      {
        x: vx,
        y: launched ? player.stunt.launchSpeed : surface ? vx * surface.gradientX + vz * surface.gradientZ : physics.body.linvel().y,
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
    const surface = applyRampSurface(position.x, position.z, this.track.ramps, sampleDrivingSurface(position.x, position.z, this.track, this.surface, position.y - KART_START.position[1], this.bridgeState.locked));
    const target = surface.height + KART_START.position[1];
    if (surface.distance > (surface.width ?? TRACK_CONFIG.roadWidth) / 2 + TRACK_CONFIG.curbWidth + TRACK_CONFIG.guardRail.gap || (position.y - target > KART_CONFIG.grounding.snapDistance || target - position.y > 2)) return null;
    body.setTranslation({ x: position.x, y: target, z: position.z }, true);
    return surface;
  }

  private finishPlayerStep(player: ServerPlayerState, now: number) {
    const physics = this.physicsPlayers.get(player.id);
    if (!physics) {
      return;
    }
    const point = physics.body.translation();
    if (stepStuntLaunch(player.stunt, point.x, point.y, point.z, player.kart.yaw,
      player.kart.speed, this.track.ramps, this.phase === "racing" && player.status === "racing" &&
      player.connection === "connected" && player.spinOutRemaining === 0, 0)) {
      const velocity = physics.body.linvel();
      physics.body.setLinvel({ x: velocity.x, y: player.stunt.launchSpeed, z: velocity.z }, true);
    }
    const road = sampleDrivingSurface(point.x, point.z, this.track, this.surface, point.y - KART_START.position[1], this.bridgeState.locked);
    if (finishStunt(player.stunt, point.y - road.height - KART_START.position[1], physics.body.linvel().y, road.distance)) {
      if (player.stunt.trickSucceeded) player.kart = applyStuntBoost(player.kart);
    }
    if (!player.stunt.active) this.constrainToRoad(physics.body);
    const velocity = physics.body.linvel();
    const forward = getKartForward(player.kart.yaw);
    player.kart = {
      ...player.kart,
      speed: velocity.x * forward.x + velocity.z * forward.z,
    };
    // Read the solver's sideways response back before the next driving step.
    player.lateralSpeed = -velocity.x * forward.z + velocity.z * forward.x;
    const item = this.items.getPlayer(player.id);
    const input = this.bots.get(player.id)?.input ?? this.input.read(player.id, now);
    this.slipstreams.update(player, physics.body.translation(), road,
      this.phase === "racing" && player.status === "racing" && player.connection === "connected" &&
      player.spinOutRemaining === 0 && (item?.lockRemaining ?? 0) === 0 &&
      player.race.respawn.protectionRemaining === 0 && input.brake === 0, input.steer);

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
      this.slipstreams.remove(player.id);
      player.slipstream = createSlipstreamState();
      this.items.clearPlayer(player.id, this.tick, [position.x, position.z]);
      player.stunt = createStuntState(this.track.id === "taipei");
      player.kart = createInitialKartState(player.kart.yaw);
      physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      physics.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
      physics.collider.setSensor(true);
      physics.contactCollider.setSensor(true);
      this.finishDeadlineTick ??= this.tick + ITEM_CONFIG.finishGraceSeconds * NETWORK_CONFIG.simulationRateHz;
    }
    if (result.respawn) {
      this.slipstreams.remove(player.id);
      player.slipstream = createSlipstreamState();
      const pose = result.respawn.pose;
      const point: Point2 = [pose.position[0], pose.position[2]];
      this.items.clearPlayer(player.id, this.tick, point, true);
      this.previousPositions.set(player.id, point);
      player.stunt = createStuntState(this.track.id === "taipei");
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
        // Kart pairs are resolved below on every actual contact, including a
        // continuing contact that emits no new collision-start event.
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
          interruptSlipstream(player.slipstream);
          physics.body.setLinvel({ ...rebound.velocity, y: physics.body.linvel().y }, true);
          const forward = getKartForward(player.kart.yaw);
          player.lateralSpeed = -rebound.velocity.x * forward.z + rebound.velocity.z * forward.x;
          player.wallReboundRemaining = KART_CONFIG.collision.reboundSeconds;
          player.impactRevision += 1;
          player.impactKind = "wall";
          player.collisionCooldown = KART_CONFIG.collision.cooldown;
        }
      }
    });
    this.processKartContacts();
  }

  private processKartContacts() {
    for (const [firstId, first] of this.physicsPlayers) for (const [secondId, second] of this.physicsPlayers) {
      if (first.contactCollider.handle >= second.contactCollider.handle) continue;
      const firstPlayer = this.players.get(firstId), secondPlayer = this.players.get(secondId);
      if (this.phase !== "racing" || !firstPlayer || !secondPlayer || firstPlayer.status !== "racing" || secondPlayer.status !== "racing") continue;
      let normal: { x: number; z: number } | null = null;
      let deepest = 0.08;
      const firstPoint = first.body.translation(), secondPoint = second.body.translation();
      this.world.contactPair(first.contactCollider, second.contactCollider, manifold => {
        for (let i = 0; i < manifold.numSolverContacts(); i++) {
          const distance = manifold.solverContactDist(i);
          if (distance > deepest) continue;
          const candidate = manifold.normal();
          if (Math.hypot(candidate.x, candidate.z) < 0.2) continue;
          const orientation = candidate.x * (secondPoint.x - firstPoint.x) + candidate.z * (secondPoint.z - firstPoint.z) >= 0 ? 1 : -1;
          normal = { x: candidate.x * orientation, z: candidate.z * orientation };
          deepest = distance;
        }
      });
      if (!normal) continue;
      const result = resolveKartCollision({ normal,
        firstVelocity: this.contactVelocities.get(firstId) ?? first.body.linvel(),
        secondVelocity: this.contactVelocities.get(secondId) ?? second.body.linvel(),
        resolvedFirstVelocity: first.body.linvel(), resolvedSecondVelocity: second.body.linvel() });
      if (!result) continue;
      interruptSlipstream(firstPlayer.slipstream);
      interruptSlipstream(secondPlayer.slipstream);
      first.body.setLinvel({ ...result.firstVelocity, y: first.body.linvel().y }, true);
      second.body.setLinvel({ ...result.secondVelocity, y: second.body.linvel().y }, true);
      firstPlayer.wallReboundRemaining = NETWORK_CONFIG.collision.reboundSeconds;
      secondPlayer.wallReboundRemaining = NETWORK_CONFIG.collision.reboundSeconds;
      if (result.impact) {
        this.applyImpact(firstPlayer, "kart");
        this.applyImpact(secondPlayer, "kart");
      }
    }
  }

  private applyImpact(player: ServerPlayerState, kind: ImpactKind) {
    if (player.collisionCooldown > 0 || player.status !== "racing" ||
      player.race.respawn.protectionRemaining > 0 || (this.items.getPlayer(player.id)?.immunityRemaining ?? 0) > 0) {
      return;
    }
    // Ordinary contact pushes and slows the kart without taking away steering.
    // Only item hits set spinOutRemaining and grant item recovery protection.
    player.impactRevision += 1;
    player.impactKind = kind;
    player.collisionCooldown = NETWORK_CONFIG.collision.eventCooldownSeconds;
  }

  private finishIfComplete() {
    if (this.phase === "lobby" || this.phase === "finished" || this.players.size === 0) {
      return;
    }
    if (this.finishDeadlineTick !== null && this.tick >= this.finishDeadlineTick) {
      for (const player of this.players.values()) {
        if (player.status !== "racing") continue;
        player.status = "dnf";
        player.slipstream = createSlipstreamState();
        player.stunt = createStuntState(this.track.id === "taipei");
        player.kart = createInitialKartState(player.kart.yaw);
        player.spinOutRemaining = 0;
        this.input.neutralize(player.id);
        this.items.clearPlayer(player.id, this.tick, this.itemRacer(player).position);
        const physics = this.physicsPlayers.get(player.id);
        physics?.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        physics?.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        physics?.collider.setSensor(true);
        physics?.contactCollider.setSensor(true);
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
      characterId: player.characterId,
      connection: player.connection,
      status: player.status,
      position: [position.x, position.y, position.z],
      yaw: player.kart.yaw,
      speed: player.kart.speed,
      steer: input.steer,
      drifting: player.kart.drift.active,
      driftTier: player.kart.drift.chargeTier,
      turboTier: player.kart.drift.turboTier,
      slipstream: slipstreamSnapshot(player.slipstream),
      spinOutRemaining: player.spinOutRemaining,
      stuntProgress: stuntProgress(player.stunt),
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
      player.stunt = createStuntState(this.track.id === "taipei");
      player.kart = createInitialKartState(pose.yaw);
      player.slipstream = createSlipstreamState();
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
        this.track.ground.width / 2,
        this.track.ground.thickness / 2,
        this.track.ground.depth / 2,
      ).setTranslation(this.track.ground.centerX, -this.track.ground.thickness / 2, this.track.ground.centerZ),
      ground,
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(this.track.geometry.DRIVABLE_MESH_DATA.vertices, this.track.geometry.DRIVABLE_MESH_DATA.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setFriction(0),
      ground,
    );
    for (const branch of this.track.branches) {
      if (branch.movable && this.track.bridge) {
        const bridge = this.track.bridge;
        for (const part of [bridge.geometries[0],bridge.geometries[2]]) {
          const mesh = part.DRIVABLE_MESH_DATA;
          this.world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices,mesh.indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0),ground);
        }
        const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...bridge.pivot));
        this.world.createCollider(RAPIER.ColliderDesc.trimesh(bridge.mesh.vertices,bridge.mesh.indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0),body);
        for (const rail of bridge.geometries[1].GUARD_RAIL_SEGMENTS) {
          const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(rail.size[0]/2,rail.size[1]/2,rail.size[2]/2)
            .setTranslation(rail.position[0]-bridge.pivot[0],rail.position[1],rail.position[2]-bridge.pivot[2])
            .setRotation(yawRotation(rail.rotationY,rail.rotationZ)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setFriction(0).setRestitution(.12),body);
          this.colliderTags.set(collider.handle,{kind:"guard"});
        }
        this.bridgeBody=body;
        this.bridgeGates=bridge.gates.map(gate=>{
          const gateBody=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(gate.position[0],gate.position[1]-4,gate.position[2]).setRotation(yawRotation(gate.yaw)));
          const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(3,1,.25).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setFriction(0).setRestitution(.12),gateBody);
          this.colliderTags.set(collider.handle,{kind:"guard"});return gateBody;
        });
        continue;
      }
      const mesh = branch.geometry.DRIVABLE_MESH_DATA;
      this.world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0), ground);
    }
    {
      const definition = createParkObstacle(this.track.race.RACE_ROUTE_SAMPLES, this.track.id, this.track.branches.find(branch => branch.id === "taipei-crossing")?.samples);
      const pose = parkObstaclePose(definition, 0);
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pose.x, pose.y, pose.z).setRotation(yawRotation(definition.yaw)));
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(definition.dimensions.halfWidth, definition.dimensions.halfHeight, definition.dimensions.halfLength).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setFriction(0).setRestitution(.12), body);
      this.colliderTags.set(collider.handle, { kind: "guard" });
      this.parkObstacle = { body, definition };
    }
    // Arcade adhesion follows the road and ramp slopes. Solid vertical curb
    // faces would snag the karts; outer guards provide the collision boundary.

    for (const segment of [...this.track.geometry.GUARD_RAIL_SEGMENTS, ...this.track.branches.flatMap(branch => branch.movable && this.track.bridge ? [...this.track.bridge.geometries[0].GUARD_RAIL_SEGMENTS,...this.track.bridge.geometries[2].GUARD_RAIL_SEGMENTS] : branch.geometry.GUARD_RAIL_SEGMENTS)]) {
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
