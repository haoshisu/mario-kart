"use client";

import { DEFAULT_CHARACTER, type CharacterId } from "../entities/characters";
import type { TrackId } from "../track/trackCatalog";

import { createSnapshotDiagnostics } from "./snapshotDiagnostics";
import { Client, type Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { getGameServerEndpoint } from "./endpoint";
import { SnapshotBuffer } from "./interpolation";
import { CLIENT_RECONNECT_TIMEOUT_MS, NETWORK_CONFIG } from "./networkConfig";
import { waitForGameServer } from "./serverReadiness";
import {
  ROOM_MESSAGE,
  type LatencyReport,
  type LobbyPlayer,
  type MultiplayerPhase,
  type ProtocolErrorMessage,
  type RaceSnapshot,
  type RoomClosedMessage,
  type RoomStatusMessage,
  type RoomMode,
} from "./protocol";
import type { KartInput } from "../core/kart/kartTypes";

export type HostRoomPhase = "idle" | "creating" | "open" | "reconnecting" | "error";

export type HostRoomState = Readonly<{
  mode: RoomMode;
  trackId: TrackId;
  playerId: string | null;
  phase: HostRoomPhase;
  roomId: string | null;
  racePhase: MultiplayerPhase;
  players: readonly LobbyPlayer[];
  canStart: boolean;
  latencyMs: number | null;
  snapshot: RaceSnapshot | null;
  error: string | null;
}>;

const INITIAL_STATE: HostRoomState = {
  mode: "multiplayer",
  trackId: "meadow",
  playerId: null,
  phase: "idle",
  roomId: null,
  racePhase: "lobby",
  players: [],
  canStart: false,
  latencyMs: null,
  snapshot: null,
  error: null,
};

const HOST_STORAGE_KEY = "kart-lab:host-room";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "無法連線至多人賽事伺服器。";
}

export function useHostRoom(): {
  state: HostRoomState;
  snapshotsRef: RefObject<SnapshotBuffer>;
  createRoom: (mode?: RoomMode, hostPlays?: boolean, trackId?: TrackId, characterId?: CharacterId) => Promise<void>;
  sendInput: (input: KartInput) => void;
  useItem: (revision: number) => void;
  closeRoom: () => Promise<void>;
  startRace: () => void;
  returnLobby: () => void;
  rematch: () => void;
} {
  const [state, setState] = useState(INITIAL_STATE);
  const roomRef = useRef<Room | null>(null);
  const inputSequenceRef = useRef(0);
  const snapshotsRef = useRef(new SnapshotBuffer());
  const manuallyClosingRef = useRef(false);
  const reconnectingRef = useRef(false);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const reconnectAttemptedRef = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const creationRef = useRef<AbortController | null>(null);

  useEffect(() => () => creationRef.current?.abort(), []);

  const bindRoom = useCallback((room: Room) => {
    const publishDiagnostics = createSnapshotDiagnostics();
    roomRef.current = room;
    inputSequenceRef.current = 0;
    reconnectingRef.current = false;
    setReconnectToken(null);
    room.reconnection.enabled = false;
    sessionStorage.setItem(
      HOST_STORAGE_KEY,
      JSON.stringify({ roomId: room.roomId, token: room.reconnectionToken }),
    );

    room.onMessage<RoomStatusMessage>(ROOM_MESSAGE.roomStatus, (status) => {
      setState((current) => ({
        ...current,
        mode: status.mode,
        trackId: status.trackId,
        playerId: status.players.some((player) => player.id === room.sessionId) ? room.sessionId : null,
        phase: status.host === "reconnecting" ? "reconnecting" : "open",
        racePhase: status.phase,
        players: status.players,
        canStart: status.canStart,
        error: null,
      }));
    });
    room.onMessage<RaceSnapshot>(ROOM_MESSAGE.snapshot, (snapshot) => {
      if (!snapshotsRef.current.add(snapshot)) {
        return;
      }
      publishDiagnostics?.(snapshot);
      const now = Date.now();
      if (now - lastUiUpdateRef.current >= 150 || snapshot.phase === "finished") {
        lastUiUpdateRef.current = now;
        setState((current) => ({
          ...current,
          racePhase: snapshot.phase,
          snapshot,
        }));
      }
    });
    room.onMessage<LatencyReport>(ROOM_MESSAGE.latency, (report) => {
      setState((current) => ({ ...current, latencyMs: Math.round(report.rttMs) }));
    });
    room.onMessage(ROOM_MESSAGE.inputApplied, () => undefined);
    room.onMessage<ProtocolErrorMessage>(ROOM_MESSAGE.protocolError, (message) => {
      setState((current) => ({ ...current, error: message.message }));
    });
    room.onMessage<RoomClosedMessage>(ROOM_MESSAGE.roomClosed, () => {
      sessionStorage.removeItem(HOST_STORAGE_KEY);
      snapshotsRef.current.clear();
      roomRef.current = null;
      setState(INITIAL_STATE);
    });
    room.onDrop(() => {
      reconnectingRef.current = true;
      setReconnectToken(room.reconnectionToken);
      setState((current) => ({ ...current, phase: "reconnecting" }));
    });
    room.onReconnect(() => {
      sessionStorage.setItem(
        HOST_STORAGE_KEY,
        JSON.stringify({ roomId: room.roomId, token: room.reconnectionToken }),
      );
      setState((current) => ({ ...current, phase: "open", error: null }));
    });
    room.onLeave(() => {
      if (roomRef.current !== room) {
        return;
      }
      if (reconnectingRef.current) {
        return;
      }
      roomRef.current = null;
      snapshotsRef.current.clear();
      sessionStorage.removeItem(HOST_STORAGE_KEY);
      if (manuallyClosingRef.current) {
        manuallyClosingRef.current = false;
        setState(INITIAL_STATE);
      } else {
        setState((current) => ({
          ...INITIAL_STATE,
          phase: "error",
          error: current.error ?? "多人房間已關閉。",
        }));
      }
    });
    room.send(ROOM_MESSAGE.requestStatus);
    setState((current) => ({
      ...current,
      phase: "open",
      roomId: room.roomId,
      error: null,
    }));
  }, []);

  const createRoom = useCallback(async (mode: RoomMode = "multiplayer", hostPlays = true, trackId: TrackId = "meadow", characterId: CharacterId = DEFAULT_CHARACTER) => {
    if (roomRef.current || creationRef.current) {
      return;
    }
    setState({ ...INITIAL_STATE, phase: "creating" });
    const creation = new AbortController();
    creationRef.current = creation;
    try {
      const endpoint = getGameServerEndpoint();
      await waitForGameServer(endpoint, creation.signal);
      creation.signal.throwIfAborted();
      const client = new Client(endpoint);
      const room = await client.create(NETWORK_CONFIG.roomType, {
        role: "host",
        mode,
        hostPlays,
        trackId,
        characterId,
        protocolVersion: NETWORK_CONFIG.protocolVersion,
      });
      if (creation.signal.aborted) {
        await room.leave();
        return;
      }
      bindRoom(room);
    } catch (error) {
      if (!creation.signal.aborted) {
        setState({ ...INITIAL_STATE, phase: "error", error: errorMessage(error) });
      }
    } finally {
      if (creationRef.current === creation) creationRef.current = null;
    }
  }, [bindRoom]);

  const closeRoom = useCallback(async () => {
    creationRef.current?.abort();
    creationRef.current = null;
    const room = roomRef.current;
    if (!room) {
      setState(INITIAL_STATE);
      return;
    }
    manuallyClosingRef.current = true;
    room.send(ROOM_MESSAGE.closeRoom);
  }, []);

  const startRace = useCallback(() => {
    roomRef.current?.send(ROOM_MESSAGE.startRace);
  }, []);

  const returnLobby = useCallback(() => {
    roomRef.current?.send(ROOM_MESSAGE.returnLobby);
  }, []);
  const rematch = useCallback(() => {
    roomRef.current?.send(ROOM_MESSAGE.rematch);
  }, []);
  const sendInput = useCallback((input: KartInput) => {
    roomRef.current?.send(ROOM_MESSAGE.input, { input, sequence: inputSequenceRef.current++, sentAt: Date.now() });
  }, []);
  const useItem = useCallback((revision: number) => {
    roomRef.current?.send(ROOM_MESSAGE.useItem, { revision });
  }, []);

  useEffect(() => {
    if (!reconnectToken) {
      return;
    }

    let cancelled = false;
    const deadline = Date.now() + CLIENT_RECONNECT_TIMEOUT_MS;
    const reconnect = async () => {
      while (!cancelled && Date.now() < deadline) {
        try {
          const client = new Client(getGameServerEndpoint());
          const room = await client.reconnect(reconnectToken);
          if (cancelled) {
            await room.leave();
            return;
          }
          bindRoom(room);
          return;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }

      if (!cancelled) {
        reconnectingRef.current = false;
        roomRef.current = null;
        sessionStorage.removeItem(HOST_STORAGE_KEY);
        setReconnectToken(null);
        snapshotsRef.current.clear();
        setState({
          ...INITIAL_STATE,
          phase: "error",
          error: "Host 重連逾時，多人房間已關閉。",
        });
      }
    };
    void reconnect();
    return () => {
      cancelled = true;
    };
  }, [bindRoom, reconnectToken]);

  useEffect(() => {
    if (reconnectAttemptedRef.current) {
      return;
    }
    reconnectAttemptedRef.current = true;
    const stored = sessionStorage.getItem(HOST_STORAGE_KEY);
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as { roomId?: unknown; token?: unknown };
      if (typeof parsed.token !== "string") {
        sessionStorage.removeItem(HOST_STORAGE_KEY);
        return;
      }
      const client = new Client(getGameServerEndpoint());
      void client.reconnect(parsed.token).then(bindRoom).catch((error: unknown) => {
        sessionStorage.removeItem(HOST_STORAGE_KEY);
        setState({ ...INITIAL_STATE, phase: "error", error: errorMessage(error) });
      });
    } catch {
      sessionStorage.removeItem(HOST_STORAGE_KEY);
    }
  }, [bindRoom]);

  return {
    state,
    snapshotsRef,
    createRoom,
    closeRoom,
    startRace,
    returnLobby,
    rematch,
    sendInput,
    useItem,
  };
}
