import { CHARACTER_IDS, DEFAULT_CHARACTER, type CharacterId } from "../../src/game/entities/characters";
import { DEFAULT_TRACK_ID, isPlayableTrackId } from "../../src/game/track/trackCatalog";
import { Room, ServerError, type Client } from "@colyseus/core";
import { NETWORK_CONFIG, PLAYER_COLORS, type PlayerColor } from "../../src/game/network/networkConfig";
import {
  ROOM_MESSAGE,
  isRoomJoinOptions,
  normalizeNickname,
  sanitizeInputPacket,
  sanitizeLatencyReport,
  sanitizeReadyMessage,
  sanitizeItemUse,
  type ParticipantConnection,
  type ProtocolErrorMessage,
  type RoomClosedMessage,
  type RoomJoinOptions,
  type RoomStatusMessage,
  type RoomMode,
} from "../../src/game/network/protocol";
import { SimulationSystem } from "../systems/SimulationSystem";
import { BOT_CONFIG } from "../systems/botConfig";
import { acquireRoom, logOperation, recordTick } from "../operations";

type ParticipantData = {
  role: "host" | "controller";
  playerId: string | null;
  lastLatencyReportAt: number;
};

type RaceClient = Client<{ userData: ParticipantData }> & { userData: ParticipantData };

type LobbyEntry = {
  sessionId: string;
  nickname: string;
  color: PlayerColor;
  characterId: CharacterId;
  ready: boolean;
  isBot: boolean;
};

const MATCHMAKING_ERROR = {
  invalidOptions: 4_001,
  hostExists: 4_002,
  hostRequired: 4_004,
  roomLocked: 4_005,
  roomFull: 4_006,
  colorUnavailable: 4_007,
} as const;

export class RaceRoom extends Room<{ client: RaceClient }> {
  private simulation!: SimulationSystem;
  private readonly lobby = new Map<string, LobbyEntry>();
  private hostSessionId: string | null = null;
  private hostConnection: ParticipantConnection = "disconnected";
  private closing = false;
  private lastSnapshotTick = -1;
  private mode: RoomMode = "multiplayer";
  private releaseCapacity: (() => void) | null = null;

  onCreate(options: { trackId?: unknown } = {}) {
    if (options.trackId !== undefined && !isPlayableTrackId(options.trackId)) throw new Error("Unknown track");
    this.simulation = new SimulationSystem(undefined, options.trackId ?? DEFAULT_TRACK_ID);
    try { this.releaseCapacity = acquireRoom(); }
    catch (error) { this.simulation?.dispose(); throw error; }
    // Keep one admission slot so onAuth can return the Phase 4-specific
    // "room full" error instead of Colyseus' generic automatic lock message.
    this.maxClients = NETWORK_CONFIG.maximumPlayers + 2;
    this.maxMessagesPerSecond = NETWORK_CONFIG.maxMessagesPerSecond;
    this.setPrivate(true);

    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.input, (client, message) => {
      this.handleInput(client, message);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.playerReady, (client, message) => {
      this.handleReady(client, message);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.startRace, (client) => {
      this.handleStart(client);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.returnLobby, (client) => {
      this.handleReturnLobby(client);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.rematch, (client) => {
      if (!this.isHost(client)) {
        this.sendProtocolError(client, "unauthorized", "Only the host can request a rematch.");
        return;
      }
      const snapshot = this.simulation.getSnapshot();
      const connected = snapshot.players.filter((player) => player.connection === "connected");
      if (snapshot.phase !== "finished" || connected.length < NETWORK_CONFIG.minimumPlayers ||
        !connected.some((player) => this.lobby.get(player.id)?.isBot === false) ||
        connected.length !== snapshot.players.filter((player) => player.connection !== "disconnected").length) {
        this.sendProtocolError(client, "room-state", "Rematch requires a connected human, at least two racers and no pending reconnects.");
        return;
      }
      this.handleReturnLobby(client);
      this.lobby.forEach((entry) => { entry.ready = true; });
      this.handleStart(client);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.useItem, (client, message) => {
      const request = sanitizeItemUse(message);
      const playerId = client.userData.playerId;
      if (!playerId) {
        this.sendProtocolError(client, "unauthorized", "Only the owning driver can use an item.");
      } else if (!request) {
        this.sendProtocolError(client, "invalid-input", "Invalid item revision.");
      } else if (!this.simulation.useItem(playerId, request.revision)) {
        this.sendProtocolError(client, "room-state", "Item unavailable or request expired.");
      }
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.latencyReport, (client, message) => {
      this.handleLatencyReport(client, message);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.closeRoom, (client) => {
      if (!this.isHost(client)) {
        this.sendProtocolError(client, "unauthorized", "Only the host can close the room.");
        return;
      }
      void this.closeRoom("host-closed");
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.requestStatus, (client) => {
      client.send(ROOM_MESSAGE.roomStatus, this.getRoomStatus());
      client.send(ROOM_MESSAGE.snapshot, this.simulation.getSnapshot());
    });

    this.setSimulationInterval(() => this.stepSimulation(), 1_000 / NETWORK_CONFIG.simulationRateHz);
  }

  onAuth(_client: RaceClient, options: unknown) {
    if (!isRoomJoinOptions(options)) {
      throw new ServerError(MATCHMAKING_ERROR.invalidOptions, "Invalid protocol version or join options.");
    }
    if (this.hostSessionId === null && options.role !== "host") {
      throw new ServerError(MATCHMAKING_ERROR.hostRequired, "The host must create the room first.");
    }
    if (options.role === "host" && this.hostSessionId !== null) {
      throw new ServerError(MATCHMAKING_ERROR.hostExists, "This room already has a host.");
    }
    if (options.role === "controller") {
      if (this.mode === "solo-keyboard" || (this.mode === "solo-phone" &&
        [...this.lobby.values()].some((entry) => !entry.isBot))) {
        throw new ServerError(MATCHMAKING_ERROR.roomFull, "Single-player room already has its driver.");
      }
      if (this.simulation.getPhase() !== "lobby") {
        throw new ServerError(MATCHMAKING_ERROR.roomLocked, "The race has already started.");
      }
      if (this.lobby.size >= NETWORK_CONFIG.maximumPlayers) {
        throw new ServerError(MATCHMAKING_ERROR.roomFull, "This room is full.");
      }
      if (options.color && [...this.lobby.values()].some((entry) => entry.color === options.color)) {
        throw new ServerError(MATCHMAKING_ERROR.colorUnavailable, "That kart color is already in use.");
      }
    }
    return options;
  }

  onJoin(client: RaceClient, options: RoomJoinOptions) {
    logOperation("joined");
    const characterId = options.characterId ?? DEFAULT_CHARACTER;
    client.userData = {
      role: options.role,
      playerId: options.role === "controller" ? client.sessionId : null,
      lastLatencyReportAt: 0,
    };

    if (options.role === "host") {
      this.hostSessionId = client.sessionId;
      this.hostConnection = "connected";
      this.mode = options.mode ?? "multiplayer";
      if (this.mode === "solo-keyboard" || (this.mode === "multiplayer" && options.hostPlays)) {
        client.userData.playerId = client.sessionId;
        this.lobby.set(client.sessionId, { sessionId: client.sessionId, nickname: "玩家", color: PLAYER_COLORS[0], characterId, ready: true, isBot: false });
        this.simulation.addPlayer(client.sessionId, "玩家", PLAYER_COLORS[0], undefined, characterId);
        if (this.mode === "solo-keyboard") this.addBots();
      }
    } else {
      const color = options.color ?? this.firstAvailableColor();
      const nickname = normalizeNickname(options.nickname);
      this.lobby.set(client.sessionId, {
        sessionId: client.sessionId,
        nickname,
        color,
        characterId,
        ready: false,
        isBot: false,
      });
      this.simulation.addPlayer(client.sessionId, nickname, color, undefined, characterId);
      if (this.mode === "solo-phone") this.addBots();
    }
    this.broadcastRoomStatus();
  }

  async onDrop(client: RaceClient) {
    if (this.closing) return;
    if (this.isHost(client)) {
      this.hostConnection = "reconnecting";
    }
    if (client.userData.playerId) {
      this.simulation.setConnection(client.userData.playerId, "reconnecting");
    }
    this.broadcastRoomStatus();

    try {
      await this.allowReconnection(client, NETWORK_CONFIG.reconnectSeconds);
    } catch {
      // Colyseus calls onLeave when the reservation expires.
    }
  }

  onReconnect(client: RaceClient) {
    if (this.closing) return;
    if (this.isHost(client)) {
      this.hostConnection = "connected";
    }
    if (client.userData.playerId) {
      this.simulation.setConnection(client.userData.playerId, "connected");
      this.simulation.input.resetSequences(client.userData.playerId);
    }
    client.send(ROOM_MESSAGE.snapshot, this.simulation.getSnapshot());
    this.broadcastRoomStatus();
  }

  onLeave(client: RaceClient) {
    logOperation("left");
    if (this.closing) return;
    if (this.isHost(client)) { void this.closeRoom("host-left"); return; }
    const playerId = client.userData.playerId;
    if (playerId) {
      if (this.simulation.getPhase() === "lobby") {
        this.lobby.delete(playerId);
        this.simulation.removePlayer(playerId);
        if (this.mode === "solo-phone") this.removeBots();
      } else {
        this.simulation.markDnf(playerId);
      }
      this.broadcastRoomStatus();
      this.broadcast(ROOM_MESSAGE.snapshot, this.simulation.getSnapshot());
      return;
    }

  }

  onDispose() {
    this.closing = true;
    this.simulation?.dispose();
    this.releaseCapacity?.();
    this.releaseCapacity = null;
  }

  private stepSimulation() {
    if (this.closing) return;
    const previousPhase = this.simulation.getPhase();
    const startedAt = performance.now();
    this.simulation.step();
    recordTick(performance.now() - startedAt);
    if (this.simulation.getPhase() !== previousPhase) {
      this.broadcastRoomStatus();
    }
    const snapshotEvery = NETWORK_CONFIG.simulationRateHz / NETWORK_CONFIG.snapshotRateHz;
    const tick = this.simulation.getTick();
    if (tick - this.lastSnapshotTick >= snapshotEvery) {
      this.lastSnapshotTick = tick;
      this.broadcast(ROOM_MESSAGE.snapshot, this.simulation.getSnapshot());
    }
  }

  private handleInput(client: RaceClient, message: unknown) {
    const playerId = client.userData.playerId;
    if (!playerId) {
      this.sendProtocolError(client, "unauthorized", "Only the owning driver can send input.");
      return;
    }
    const packet = sanitizeInputPacket(message);
    if (!packet) {
      this.sendProtocolError(client, "invalid-input", "Input packet failed validation.");
      return;
    }
    const rejection = this.simulation.input.receive(playerId, packet, Date.now());
    if (rejection) {
      this.sendProtocolError(client, "rate-limited", `Input rejected: ${rejection}.`);
      return;
    }
    client.send(ROOM_MESSAGE.inputApplied, {
      sequence: packet.sequence,
      sentAt: packet.sentAt,
      serverTick: this.simulation.getTick(),
    });
  }

  private handleReady(client: RaceClient, message: unknown) {
    const playerId = client.userData.playerId;
    const ready = sanitizeReadyMessage(message);
    if (!playerId || !ready) {
      this.sendProtocolError(client, playerId ? "invalid-input" : "unauthorized", "Invalid ready state.");
      return;
    }
    if (this.simulation.getPhase() !== "lobby") {
      this.sendProtocolError(client, "room-state", "Ready can only change in the lobby.");
      return;
    }
    const entry = this.lobby.get(playerId);
    if (entry) {
      entry.ready = ready.ready;
      this.broadcastRoomStatus();
    }
  }

  private handleStart(client: RaceClient) {
    if (!this.isHost(client)) {
      this.sendProtocolError(client, "unauthorized", "Only the host can start the race.");
      return;
    }
    if (!this.canStart()) {
      this.sendProtocolError(client, "not-ready", "At least two connected, ready players are required.");
      return;
    }
    if (!this.simulation.start()) {
      this.sendProtocolError(client, "room-state", "The race has already started.");
      return;
    }
    this.broadcastRoomStatus();
    this.broadcast(ROOM_MESSAGE.snapshot, this.simulation.getSnapshot());
  }

  private handleReturnLobby(client: RaceClient) {
    if (!this.isHost(client)) {
      this.sendProtocolError(client, "unauthorized", "Only the host can return to the lobby.");
      return;
    }
    if (this.simulation.getPhase() !== "finished") {
      this.sendProtocolError(client, "room-state", "The race is not finished.");
      return;
    }
    const disconnectedPlayerIds = this.simulation.getSnapshot().players
      .filter((player) => player.connection === "disconnected")
      .map((player) => player.id);
    disconnectedPlayerIds.forEach((playerId) => {
      this.lobby.delete(playerId);
      this.simulation.removePlayer(playerId);
    });
    this.lobby.forEach((entry) => {
      entry.ready = entry.isBot || entry.sessionId === this.hostSessionId;
    });
    if (this.mode === "solo-phone" && ![...this.lobby.values()].some((entry) => !entry.isBot)) this.removeBots();
    this.simulation.returnToLobby();
    this.broadcastRoomStatus();
  }

  private handleLatencyReport(client: RaceClient, message: unknown) {
    if (!client.userData.playerId) {
      this.sendProtocolError(client, "unauthorized", "Only a controller can report latency.");
      return;
    }
    const report = sanitizeLatencyReport(message);
    if (!report) {
      this.sendProtocolError(client, "invalid-input", "Latency report failed validation.");
      return;
    }
    const now = Date.now();
    if (now - client.userData.lastLatencyReportAt < NETWORK_CONFIG.latencyReportMinimumIntervalMs) {
      return;
    }
    client.userData.lastLatencyReportAt = now;
    this.hostClient()?.send(ROOM_MESSAGE.latency, report);
  }

  private canStart() {
    const entries = [...this.lobby.values()];
    const connections = new Map(
      this.simulation.getSnapshot().players.map((player) => [player.id, player.connection]),
    );
    return (
      this.simulation.getPhase() === "lobby" &&
      entries.length >= NETWORK_CONFIG.minimumPlayers &&
      (this.mode === "multiplayer" || entries.length === BOT_CONFIG.count + 1) &&
      entries.every(
        (entry) => entry.ready && connections.get(entry.sessionId) === "connected",
      )
    );
  }

  private getRoomStatus(): RoomStatusMessage {
    const snapshotPlayers = new Map(
      this.simulation.getSnapshot().players.map((player) => [player.id, player]),
    );
    return {
      trackId: this.simulation.track.id,
      mode: this.mode,
      host: this.hostConnection,
      phase: this.simulation.getPhase(),
      players: [...this.lobby.values()].map((entry) => {
        const snapshot = snapshotPlayers.get(entry.sessionId);
        return {
          id: entry.sessionId,
          nickname: entry.nickname,
          color: entry.color,
          characterId: entry.characterId,
          ready: entry.ready,
          connection: snapshot?.connection ?? "disconnected",
          raceStatus: snapshot?.status ?? "waiting",
          isBot: entry.isBot,
        };
      }),
      canStart: this.canStart(),
    };
  }

  private broadcastRoomStatus() {
    this.broadcast(ROOM_MESSAGE.roomStatus, this.getRoomStatus());
  }

  private addBots() {
    for (let index = 0; index < BOT_CONFIG.count; index += 1) {
      const id = `cpu-${index + 1}`;
      const color = this.firstAvailableColor();
      const nickname = `電腦 ${index + 1}`;
      const characterId = CHARACTER_IDS.find(id => ![...this.lobby.values()].some(entry => entry.characterId === id)) ?? DEFAULT_CHARACTER;
      this.lobby.set(id, { sessionId: id, nickname, color, characterId, ready: true, isBot: true });
      this.simulation.addPlayer(id, nickname, color, BOT_CONFIG.laneOffsets[index], characterId);
    }
  }

  private removeBots() {
    for (const [id, entry] of this.lobby) {
      if (entry.isBot) { this.simulation.removePlayer(id); this.lobby.delete(id); }
    }
  }

  private firstAvailableColor() {
    return PLAYER_COLORS.find(
      (color) => ![...this.lobby.values()].some((entry) => entry.color === color),
    ) ?? PLAYER_COLORS[0];
  }

  private sendProtocolError(
    client: RaceClient,
    code: ProtocolErrorMessage["code"],
    message: string,
  ) {
    const error: ProtocolErrorMessage = { code, message };
    client.send(ROOM_MESSAGE.protocolError, error);
  }

  private isHost(client: RaceClient) {
    return client.sessionId === this.hostSessionId && client.userData.role === "host";
  }

  private hostClient() {
    return this.clients.find((client) => client.sessionId === this.hostSessionId);
  }

  private async closeRoom(reason: RoomClosedMessage["reason"]) {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.broadcast(ROOM_MESSAGE.roomClosed, { reason } satisfies RoomClosedMessage);
    await this.disconnect();
  }
}
