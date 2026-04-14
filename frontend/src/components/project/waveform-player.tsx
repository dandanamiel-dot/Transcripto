"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

import { BACKEND_URL, TAG_CATEGORY_COLORS } from "@/lib/constants";
import { usePlayerStore } from "@/stores/player-store";
import type { Tag } from "@/lib/api";

const WAVE_COLOR = "oklch(0.70 0.05 275)"; // muted lavender
const PROGRESS_COLOR = "oklch(0.55 0.22 275)"; // accent purple
const CURSOR_COLOR = "oklch(0.45 0.25 275)";

function hexWithAlpha(hex: string, alpha: number): string {
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
  const [wsDuration, setWsDuration] = useState(0);
  const [hoveredTag, setHoveredTag] = useState<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const {
    setCurrentTime,
    setDuration,
    setIsPlaying,
    playbackRate,
    registerSeekCallback,
    registerTogglePlayCallback,
  } = usePlayerStore();

  const seekTo = usePlayerStore((s) => s.seekTo);

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
      height: 72,
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

    const unsubReady = ws.on("ready", (duration) => {
      setDuration(duration);
      setWsDuration(duration);
    });
    const unsubTime = ws.on("timeupdate", (currentTime) => {
      setCurrentTime(currentTime);
    });
    const unsubPlay = ws.on("play", () => setIsPlaying(true));
    const unsubPause = ws.on("pause", () => setIsPlaying(false));
    const unsubFinish = ws.on("finish", () => setIsPlaying(false));

    registerSeekCallback((t: number) => {
      const instance = wavesurferRef.current;
      if (!instance) return;
      instance.setTime(t);
      if (!instance.isPlaying()) {
        instance.play().catch(() => {});
      }
    });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Forward playback rate changes.
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setPlaybackRate(playbackRate, true);
  }, [playbackRate]);

  // Draw subtle highlight regions on the waveform (no text).
  useEffect(() => {
    const ws = wavesurferRef.current;
    const regions = regionsRef.current;
    if (!ws || !regions) return;

    const applyRegions = () => {
      regions.clearRegions();
      const duration = ws.getDuration();
      if (!duration) return;

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
          color: hexWithAlpha(tag.color || "#8B5CF6", 0.12),
          drag: false,
          resize: false,
        });
        region.on("click", (e) => {
          e.stopPropagation();
          ws.setTime(start);
          if (!ws.isPlaying()) ws.play().catch(() => {});
        });
      }
    };

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

  // Tags with timestamps for the marker track
  const tagMarkers = wsDuration > 0
    ? tags.filter((t) => t.timestamp != null)
    : [];

  const handleMarkerClick = useCallback(
    (tag: Tag) => {
      if (tag.timestamp != null) seekTo(tag.timestamp);
    },
    [seekTo],
  );

  return (
    <div className="space-y-0">
      {/* Waveform */}
      <div
        dir="ltr"
        ref={containerRef}
        className="w-full rounded-t-lg bg-muted/30 px-2 py-2"
      />

      {/* Tag marker track */}
      {tagMarkers.length > 0 && (
        <div
          dir="ltr"
          className="relative w-full h-5 bg-muted/20 rounded-b-lg border-t border-border/40 px-2 overflow-visible"
        >
          {tagMarkers.map((tag) => {
            const pct = ((tag.timestamp ?? 0) / wsDuration) * 100;
            const color = tag.color || TAG_CATEGORY_COLORS[tag.category ?? "keyword"] || "#8B5CF6";
            const isHovered = hoveredTag === tag.id;

            return (
              <div
                key={tag.id}
                className="absolute top-0 bottom-0 flex flex-col items-center cursor-pointer group"
                style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                onClick={() => handleMarkerClick(tag)}
                onMouseEnter={() => setHoveredTag(tag.id)}
                onMouseLeave={() => setHoveredTag(null)}
              >
                {/* Tick line */}
                <div
                  className="w-0.5 h-2.5 rounded-full mt-0.5"
                  style={{ backgroundColor: color }}
                />
                {/* Dot */}
                <div
                  className="w-1.5 h-1.5 rounded-full transition-transform"
                  style={{
                    backgroundColor: color,
                    transform: isHovered ? "scale(1.8)" : "scale(1)",
                  }}
                />
                {/* Tooltip */}
                {isHovered && (
                  <div
                    ref={tooltipRef}
                    className="absolute top-full mt-1 z-50 pointer-events-none"
                  >
                    <div
                      className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-lg border border-border/50"
                      style={{
                        backgroundColor: hexWithAlpha(color, 0.12),
                        color,
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {tag.label}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
