import { create } from "zustand";
import { BACKEND_URL } from "@/lib/constants";
import type { Segment } from "@/lib/api";

type TranscriptionStatus =
  | "idle"
  | "extracting_audio"
  | "processing"
  | "diarizing"
  | "diarize_failed"
  | "complete"
  | "error";

interface TranscriptionState {
  status: TranscriptionStatus;
  liveSegments: Segment[];
  segmentCount: number;
  error: string | null;
  ws: WebSocket | null;
  duration: number | null;

  connect: (projectId: number) => void;
  disconnect: () => void;
  reset: () => void;
}

let segmentIdCounter = -1; // temporary IDs for live segments

export const useTranscriptionStore = create<TranscriptionState>((set, get) => ({
  status: "idle",
  liveSegments: [],
  segmentCount: 0,
  error: null,
  ws: null,
  duration: null,

  connect: (projectId: number) => {
    const prev = get().ws;
    if (prev) prev.close();

    segmentIdCounter = -1;

    const wsUrl = BACKEND_URL.replace(/^http/, "ws");
    const ws = new WebSocket(
      `${wsUrl}/api/ws/transcription/${projectId}`,
    );

    ws.onopen = () => {
      set({ status: "idle", liveSegments: [], error: null, ws, duration: null });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "status":
            set((s) => ({
              status: data.step as TranscriptionStatus,
              duration: data.duration ?? s.duration,
            }));
            break;

          case "segment": {
            const seg: Segment = {
              id: segmentIdCounter--,
              project_id: projectId,
              segment_index: data.data.segment_index,
              start_time: data.data.start_time,
              end_time: data.data.end_time,
              text: data.data.text,
              confidence: data.data.confidence ?? null,
              speaker: null,
            };
            set((s) => ({ liveSegments: [...s.liveSegments, seg] }));
            break;
          }

          case "complete":
            set({
              status: "complete",
              segmentCount: data.segment_count,
            });
            break;

          case "error":
            set({ status: "error", error: data.message });
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      set({ status: "error", error: "WebSocket connection failed" });
    };

    ws.onclose = () => {
      set({ ws: null });
    };

    set({ ws });
  },

  disconnect: () => {
    const ws = get().ws;
    if (ws) ws.close();
    set({ ws: null });
  },

  reset: () => {
    const ws = get().ws;
    if (ws) ws.close();
    set({
      status: "idle",
      liveSegments: [],
      segmentCount: 0,
      error: null,
      ws: null,
      duration: null,
    });
  },
}));
