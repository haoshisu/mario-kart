import {
  Room,
  ServerError,
  type Client,
} from "@colyseus/core";
import { EMPTY_KART_INPUT } from "../../src/game/core/kart/kartTypes";
import { NETWORK_CONFIG } from "../../src/game/network/networkConfig";
import {
  ROOM_MESSAGE,
  isNeutralInput,
  isRoomJoinOptions,
  normalizeNickname,
  sanitizeInputApplied,
  sanitizeInputPacket,
  sanitizeLatencyReport,
  type InputResetMessage,
  type ParticipantConnection,
  type ProtocolErrorMessage,
  type RelayedInputPacket,
  type RoomClosedMessage,
  type RoomJoinOptions,
  type RoomStatusMessage,
} from "../../src/game/network/protocol";

type ParticipantData = {
  role: "host" | "controller";
  nickname: string;
  lastSequence: number;
  lastInputAt: number;
  lastLatencyReportAt: number;
  inputIsNeutral: boolean;
};

type RaceClient = Client<{ userData: ParticipantData }> & { userData: ParticipantData };

const MATCHMAKING_ERROR = {
  invalidOptions: 4_001,
  hostExists: 4_002,
  controllerExists: 4_003,
  hostRequired: 4_004,
} as const;

export class RaceRoom extends Room<{ client: RaceClient }> {
  private hostSessionId: string | null = null;
  private controllerSessionId: string | null = null;
  private hostConnection: ParticipantConnection = "waiting";
  private controllerConnection: ParticipantConnection = "waiting";
  private controllerNickname: string | null = null;
  private closing = false;

  onCreate() {
    this.maxClients = 2;
    this.maxMessagesPerSecond = NETWORK_CONFIG.maxMessagesPerSecond;
    this.setPrivate(true);

    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.input, (client, message) => {
      this.handleInput(client, message);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.inputApplied, (client, message) => {
      this.handleInputApplied(client, message);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.latencyReport, (client, message) => {
      this.handleLatencyReport(client, message);
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.closeRoom, (client) => {
      if (client.sessionId !== this.hostSessionId) {
        this.sendProtocolError(client, "unauthorized", "Only the host can close the room.");
        return;
      }
      void this.closeRoom("host-closed");
    });
    this.onMessage<unknown, RaceClient>(ROOM_MESSAGE.requestStatus, (client) => {
      client.send(ROOM_MESSAGE.roomStatus, this.getRoomStatus());
    });

    this.clock.setInterval(() => this.resetTimedOutInput(), 50);
  }

  onAuth(_client: RaceClient, options: unknown) {
    if (!isRoomJoinOptions(options)) {
      throw new ServerError(MATCHMAKING_ERROR.invalidOptions, "Invalid room join options.");
    }

    if (this.hostSessionId === null && options.role !== "host") {
      throw new ServerError(MATCHMAKING_ERROR.hostRequired, "The host must create the room first.");
    }
    if (options.role === "host" && this.hostSessionId !== null) {
      throw new ServerError(MATCHMAKING_ERROR.hostExists, "This room already has a host.");
    }
    if (options.role === "controller" && this.controllerSessionId !== null) {
      throw new ServerError(MATCHMAKING_ERROR.controllerExists, "This room already has a controller.");
    }

    return options;
  }

  onJoin(client: RaceClient, options: RoomJoinOptions) {
    client.userData = {
      role: options.role,
      nickname: options.role === "controller" ? normalizeNickname(options.nickname) : "Host",
      lastSequence: -1,
      lastInputAt: 0,
      lastLatencyReportAt: 0,
      inputIsNeutral: true,
    };

    if (options.role === "host") {
      this.hostSessionId = client.sessionId;
      this.hostConnection = "connected";
    } else {
      this.controllerSessionId = client.sessionId;
      this.controllerNickname = client.userData.nickname;
      this.controllerConnection = "connected";
      this.hostClient()?.send(ROOM_MESSAGE.roomStatus, this.getRoomStatus());
    }
  }

  async onDrop(client: RaceClient) {
    if (client.sessionId === this.controllerSessionId) {
      this.controllerConnection = "reconnecting";
      this.resetHostInput("disconnected");
    } else if (client.sessionId === this.hostSessionId) {
      this.hostConnection = "reconnecting";
    }
    this.broadcastRoomStatus();

    try {
      await this.allowReconnection(client, NETWORK_CONFIG.reconnectSeconds);
    } catch {
      // Colyseus continues to onLeave after the reconnection window expires.
    }
  }

  onReconnect(client: RaceClient) {
    client.userData.lastSequence = -1;
    client.userData.lastInputAt = 0;
    client.userData.inputIsNeutral = true;

    if (client.sessionId === this.controllerSessionId) {
      this.controllerConnection = "connected";
    } else if (client.sessionId === this.hostSessionId) {
      this.hostConnection = "connected";
    }
    this.broadcastRoomStatus();
  }

  onLeave(client: RaceClient) {
    if (client.sessionId === this.controllerSessionId) {
      this.controllerSessionId = null;
      this.controllerNickname = null;
      this.controllerConnection = "waiting";
      this.resetHostInput("disconnected");
      this.broadcastRoomStatus();
      return;
    }

    if (client.sessionId === this.hostSessionId && !this.closing) {
      void this.closeRoom("host-left");
    }
  }

  private handleInput(client: RaceClient, message: unknown) {
    if (client.sessionId !== this.controllerSessionId || client.userData.role !== "controller") {
      this.sendProtocolError(client, "unauthorized", "Only the paired controller can send input.");
      return;
    }

    const packet = sanitizeInputPacket(message);
    if (!packet) {
      this.sendProtocolError(client, "invalid-input", "Input packet failed validation.");
      return;
    }

    const now = Date.now();
    if (
      packet.sequence <= client.userData.lastSequence ||
      now - client.userData.lastInputAt < NETWORK_CONFIG.inputMinimumIntervalMs
    ) {
      this.sendProtocolError(client, "rate-limited", "Input packet was too fast or out of order.");
      return;
    }

    client.userData.lastSequence = packet.sequence;
    client.userData.lastInputAt = now;
    client.userData.inputIsNeutral = isNeutralInput(packet.input);

    const relayed: RelayedInputPacket = {
      ...packet,
      serverReceivedAt: now,
    };
    this.hostClient()?.send(ROOM_MESSAGE.inputRelay, relayed);
  }

  private handleLatencyReport(client: RaceClient, message: unknown) {
    if (client.sessionId !== this.controllerSessionId) {
      this.sendProtocolError(client, "unauthorized", "Only the controller can report latency.");
      return;
    }

    const report = sanitizeLatencyReport(message);
    if (!report) {
      this.sendProtocolError(client, "invalid-input", "Latency report failed validation.");
      return;
    }

    const now = Date.now();
    if (
      now - client.userData.lastLatencyReportAt <
      NETWORK_CONFIG.latencyReportMinimumIntervalMs
    ) {
      return;
    }
    client.userData.lastLatencyReportAt = now;
    this.hostClient()?.send(ROOM_MESSAGE.latency, report);
  }

  private handleInputApplied(client: RaceClient, message: unknown) {
    if (client.sessionId !== this.hostSessionId || client.userData.role !== "host") {
      this.sendProtocolError(client, "unauthorized", "Only the host can acknowledge input.");
      return;
    }

    const applied = sanitizeInputApplied(message);
    if (!applied) {
      this.sendProtocolError(client, "invalid-input", "Input acknowledgement failed validation.");
      return;
    }

    this.controllerClient()?.send(ROOM_MESSAGE.inputApplied, applied);
  }

  private resetTimedOutInput() {
    const controller = this.controllerClient();
    if (
      !controller ||
      controller.userData.inputIsNeutral ||
      Date.now() - controller.userData.lastInputAt <= NETWORK_CONFIG.inputTimeoutMs
    ) {
      return;
    }

    controller.userData.inputIsNeutral = true;
    this.resetHostInput("timeout");
  }

  private resetHostInput(reason: InputResetMessage["reason"]) {
    const reset: InputResetMessage = { reason };
    this.hostClient()?.send(ROOM_MESSAGE.inputReset, reset);
  }

  private broadcastRoomStatus() {
    this.broadcast(ROOM_MESSAGE.roomStatus, this.getRoomStatus());
  }

  private getRoomStatus(): RoomStatusMessage {
    return {
      host: this.hostConnection,
      controller: this.controllerConnection,
      controllerNickname: this.controllerNickname,
    };
  }

  private sendProtocolError(
    client: RaceClient,
    code: ProtocolErrorMessage["code"],
    message: string,
  ) {
    const error: ProtocolErrorMessage = { code, message };
    client.send(ROOM_MESSAGE.protocolError, error);
  }

  private hostClient() {
    return this.clients.find((client) => client.sessionId === this.hostSessionId);
  }

  private controllerClient() {
    return this.clients.find((client) => client.sessionId === this.controllerSessionId);
  }

  private async closeRoom(reason: RoomClosedMessage["reason"]) {
    if (this.closing) {
      return;
    }
    this.closing = true;
    const message: RoomClosedMessage = { reason };
    this.broadcast(ROOM_MESSAGE.roomClosed, message);
    await this.disconnect();
  }
}

export { EMPTY_KART_INPUT };
