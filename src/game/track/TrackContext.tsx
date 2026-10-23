"use client";
import { createContext, useContext, useMemo, type ReactNode, type RefObject } from "react";
import { getTrackData } from "./trackData";
import type { TrackId } from "./trackCatalog";

import { createBridgeState, type BridgeState } from "../systems/rotatingBridge";

export type TrackRuntime = { seconds: number; bridge: BridgeState | null };
const RuntimeContext = createContext<RefObject<TrackRuntime>>({ current: { seconds: 0, bridge: null } });
const TrackContext = createContext(getTrackData());
export function TrackProvider({ id, children }: { id: TrackId; children: ReactNode }) {
  const runtime = useMemo(() => ({ current: { seconds: 0, bridge: id === "kaohsiung" ? createBridgeState() : null } }), [id]);
  return <TrackContext value={getTrackData(id)}><RuntimeContext value={runtime}>{children}</RuntimeContext></TrackContext>;
}
export function useTrack() { return useContext(TrackContext); }

export function useTrackRuntimeRef() { return useContext(RuntimeContext); }
