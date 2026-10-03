"use client";
import { createContext, useContext, type ReactNode } from "react";
import { getTrackData } from "./trackData";
import type { TrackId } from "./trackCatalog";

const TrackContext = createContext(getTrackData());
export function TrackProvider({ id, children }: { id: TrackId; children: ReactNode }) {
  return <TrackContext value={getTrackData(id)}>{children}</TrackContext>;
}
export function useTrack() { return useContext(TrackContext); }
