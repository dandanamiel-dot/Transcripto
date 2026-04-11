import { create } from "zustand";

interface PlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  activeSegmentId: number | null;

  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setActiveSegmentId: (id: number | null) => void;
  seekTo: (t: number) => void;

  // Imperative callbacks registered by the player component
  _seekCallback: ((t: number) => void) | null;
  registerSeekCallback: (cb: (t: number) => void) => void;
  _togglePlayCallback: (() => void) | null;
  registerTogglePlayCallback: (cb: () => void) => void;
  togglePlay: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1,
  activeSegmentId: null,

  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setActiveSegmentId: (id) => set({ activeSegmentId: id }),

  seekTo: (t) => {
    const cb = get()._seekCallback;
    if (cb) cb(t);
  },

  _seekCallback: null,
  registerSeekCallback: (cb) => set({ _seekCallback: cb }),

  _togglePlayCallback: null,
  registerTogglePlayCallback: (cb) => set({ _togglePlayCallback: cb }),
  togglePlay: () => {
    const cb = get()._togglePlayCallback;
    if (cb) cb();
  },
}));
