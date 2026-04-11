"use client";

import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions.esm.js";

import { BACKEND_URL } from "@/lib/constants";
import { usePlayerStore } from "@/stores/player-store";
import type { Tag } from "@/lib/api";

const WAVE_COLOR = "oklch(0.70 0.05 275)"; // muted lavender
const PROGRESS_COLOR = "oklch(0.55 0.22 275)"; // accent purple
const CURSOR_COLOR = "oklch(0.45 0.25 275)";

function hexWithAlpha(hex: string, alpha: number): string {
  // Accept "#RRGGBB" and return rgba(...)
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function WaveformPlayer({
  projectId,
  tags = [],
}: {
  projectId: number;
  tags?: Tag[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);

  const {
    setCurrentTime,
    setDuration,
    setIsPlaying,
    playbackRate,
    registerSeekCallback,
    registerTogglePlayCallback,
  } = usePlayerStore();

  // Initialize WaveSurfer once per projectId.
  useEffect(() => {
    if (!containerRef.current) return;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: `${BACKEND_URL}/api/projects/${projectId}/audio`,
      waveColor: WAVE_COLOR,
      progressColor: PROGRESS_COLOR,
      cursorColor: CURSOR_COLOR,
      cursorWidth: 2,
      height: 80,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      interact: true,
      dragToSeek: true,
      autoScroll: true,
      autoCenter: false,
      plugins: [regions],
    });

    wavesurferRef.current = ws;

    // Bridge WaveSurfer events → Zustand store
    const unsubReady = ws.on("ready", (duration) => {
      setDuration(duration);
    });
    const unsubTime = ws.on("timeupdate", (currentTime) => {
      setCurrentTime(currentTime);
    });
    const unsubPlay = ws.on("play", () => setIsPlaying(true));
    const unsubPause = ws.on("pause", () => setIsPlaying(false));
    const unsubFinish = ws.on("finish", () => setIsPlaying(false));

    // Register seek callback so other components (transcript clicks, tag list)
    // can drive playback.
    registerSeekCallback((t: number) => {
      const instance = wavesurferRef.current;
      if (!instance) return;
      instance.setTime(t);
      if (!instance.isPlaying()) {
        instance.play().catch(() => {});
      }
    });

    // Register imperative play/pause toggle used by MediaPlayer controls.
    registerTogglePlayCallback(() => {
      const instance = wavesurferRef.current;
      if (!instance) return;
      instance.playPause().catch(() => {});
    });

    return () => {
      unsubReady();
      unsubTime();
      unsubPlay();
      unsubPause();
      unsubFinish();
      ws.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
    // Re-initialize only when the project (audio source) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Forward playback rate changes.
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setPlaybackRate(playbackRate, true);
  }, [playbackRate]);

  // Re-draw tag regions whenever the tag list changes.
  useEffect(() => {
    const ws = wavesurferRef.current;
    const regions = regionsRef.current;
    if (!ws || !regions) return;

    const applyRegions = () => {
      regions.clearRegions();
      const duration = ws.getDuration();
      if (!duration) return;

      const createdRegions: Region[] = [];
      for (const tag of tags) {
        if (tag.timestamp == null) continue;
        const start = Math.max(0, Math.min(duration, tag.timestamp));
        const rawEnd =
          tag.end_timestamp != null
            ? Math.max(0, Math.min(duration, tag.end_timestamp))
            : Math.min(duration, tag.timestamp + 0.5);
        const end = rawEnd > start ? rawEnd : Math.min(duration, start + 0.5);

        const region = regions.addRegion({
          id: `tag-${tag.id}`,
          start,
          end,
          color: hexWithAlpha(tag.color || "#8B5CF6", 0.25),
          content: tag.label,
          drag: false,
          resize: false,
        });
        createdRegions.push(region);
        region.on("click", (e) => {
          e.stopPropagation();
          ws.setTime(start);
          if (!ws.isPlaying()) ws.play().catch(() => {});
        });
      }
      return createdRegions;
    };

    // If already loaded, apply immediately; otherwise wait for ready.
    if (ws.getDuration() > 0) {
      applyRegions();
    } else {
      const unsub = ws.on("ready", () => {
        applyRegions();
        unsub();
      });
      return unsub;
    }
  }, [tags]);

  return (
    <div
      dir="ltr"
      ref={containerRef}
      className="w-full rounded-lg bg-muted/30 px-2 py-2"
    />
  );
}
