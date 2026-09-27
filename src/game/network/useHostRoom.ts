"use client";

import { Client, type Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import { getGameServerEndpoint } from "./endpoint";
import { NETWORK_CONFIG } from "./networkConfig";
import {
  ROOM_MESSAGE,
  sanitizeInputPacket,
  type InputAppliedMessage,
  type InputResetMessage,
  type LatencyReport,
  type ParticipantConnection,
  type RelayedInputPacket,
  type RoomClosedMessage,
  type RoomStatusMessage,
} from "./protocol";

export type HostRoomPhase = "idle" | "creating" | "open" | "reconnecting" | "error";

export type HostRoomState = Readonly<{
  phase: HostRoomPhase;
  roomId: string | null;
  controller: ParticipantConnection;
  controllerNickname: string | null;
  latencyMs: number | null;
  error: string | null;
}>;

const INITIAL_STATE: HostRoomState = {
  phase: "idle",
  roomId: null,
  controller: "waiting",
  controllerNickname: null,
  latencyMs: null,
  error: null,
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "無法連線至控制器伺服器。";
}

export function useHostRoom(): {
  state: HostRoomState;
  inputRef: RefObject<KartInput>;
  inputReceiptRef: RefObject<InputAppliedMessage | null>;
  acknowledgeInput: (message: InputAppliedMessage) => void;
  createRoom: () => Promise<void>;
  closeRoom: () => Promise<void>;
} {
  const [state, setState] = useState(INITIAL_STATE);
  const roomRef = useRef<Room | null>(null);
  const inputRef = useRef<KartInput>(EMPTY_KART_INPUT);
  const inputReceiptRef = useRef<InputAppliedMessage | null>(null);
  const manuallyClosingRef = useRef(false);

  const bindRoom = useCallback((room: Room) => {
    roomRef.current = room;
    room.reconnection.maxRetries = 8;
    room.reconnection.minDelay = 200;
    room.reconnection.maxDelay = 1_200;

    room.onMessage<RelayedInputPacket>(ROOM_MESSAGE.inputRelay, (packet) => {
      const sanitized = sanitizeInputPacket(packet);
      if (sanitized) {
        inputRef.current = sanitized.input;
        inputReceiptRef.current = {
          sequence: sanitized.sequence,
          sentAt: sanitized.sentAt,
        };
      }
    });
    room.onMessage<InputResetMessage>(ROOM_MESSAGE.inputReset, () => {
      inputRef.current = EMPTY_KART_INPUT;
      inputReceiptRef.current = null;
    });
    room.onMessage<RoomStatusMessage>(ROOM_MESSAGE.roomStatus, (status) => {
      setState((current) => ({
        ...current,
        phase: status.host === "reconnecting" ? "reconnecting" : "open",
        controller: status.controller,
        controllerNickname: status.controllerNickname,
      }));
    });
    room.onMessage<LatencyReport>(ROOM_MESSAGE.latency, (report) => {
      setState((current) => ({ ...current, latencyMs: Math.round(report.rttMs) }));
    });
    room.onMessage<RoomClosedMessage>(ROOM_MESSAGE.roomClosed, () => {
      inputRef.current = EMPTY_KART_INPUT;
      inputReceiptRef.current = null;
      roomRef.current = null;
      setState(INITIAL_STATE);
    });

    room.onDrop(() => {
      inputRef.current = EMPTY_KART_INPUT;
      inputReceiptRef.current = null;
      setState((current) => ({ ...current, phase: "reconnecting" }));
    });
    room.onReconnect(() => {
      setState((current) => ({ ...current, phase: "open", error: null }));
    });
    room.onLeave(() => {
      inputRef.current = EMPTY_KART_INPUT;
      inputReceiptRef.current = null;
      roomRef.current = null;
      if (manuallyClosingRef.current) {
        manuallyClosingRef.current = false;
        setState(INITIAL_STATE);
      } else {
        setState((current) => ({
          ...INITIAL_STATE,
          phase: "error",
          error: current.error ?? "控制器房間已關閉。",
        }));
      }
    });
    room.send(ROOM_MESSAGE.requestStatus);
  }, []);

  const createRoom = useCallback(async () => {
    if (roomRef.current) {
      return;
    }
    setState({ ...INITIAL_STATE, phase: "creating" });

    try {
      const client = new Client(getGameServerEndpoint());
      const room = await client.create(NETWORK_CONFIG.roomType, { role: "host" });
      bindRoom(room);
      setState({
        ...INITIAL_STATE,
        phase: "open",
        roomId: room.roomId,
      });
    } catch (error) {
      setState({ ...INITIAL_STATE, phase: "error", error: errorMessage(error) });
    }
  }, [bindRoom]);

  const closeRoom = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setState(INITIAL_STATE);
      return;
    }
    manuallyClosingRef.current = true;
    inputRef.current = EMPTY_KART_INPUT;
    inputReceiptRef.current = null;
    room.send(ROOM_MESSAGE.closeRoom);
  }, []);

  const acknowledgeInput = useCallback((message: InputAppliedMessage) => {
    roomRef.current?.send(ROOM_MESSAGE.inputApplied, message);
  }, []);

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) {
        room.send(ROOM_MESSAGE.closeRoom);
        void room.leave();
      }
      inputRef.current = EMPTY_KART_INPUT;
      inputReceiptRef.current = null;
    };
  }, []);

  return {
    state,
    inputRef,
    inputReceiptRef,
    acknowledgeInput,
    createRoom,
    closeRoom,
  };
}
