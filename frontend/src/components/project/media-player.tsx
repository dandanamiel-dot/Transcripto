"use client";

import { useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePlayerStore } from "@/stores/player-store";
import { BACKEND_URL, HE } from "@/lib/constants";
import type { Tag } from "@/lib/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function MediaPlayer({
  projectId,
  tags = [],
}: {
  projectId: number;
  tags?: Tag[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setPlaybackRate,
    registerSeekCallback,
    seekTo,
  } = usePlayerStore();

  // Register seek callback so other components can control playback
  useEffect(() => {
    registerSeekCallback((t: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = t;
        if (!isPlaying) {
          audio.play();
        }
      }
    });
  }, [registerSeekCallback, isPlaying]);

  // Sync playback rate to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + delta));
    }
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const audio = audioRef.current;
      if (!bar || !audio || !duration) return;
      const rect = bar.getBoundingClientRect();
      // RTL: progress goes right-to-left
      const ratio = (rect.right - e.clientX) / rect.width;
      audio.currentTime = Math.max(0, ratio * duration);
    },
    [duration],
  );

  const cycleRate = useCallback(() => {
    const idx = PLAYBACK_RATES.indexOf(playbackRate);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <audio
        ref={audioRef}
        src={`${BACKEND_URL}/api/projects/${projectId}/audio`}
        preload="metadata"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Progress bar with tag markers */}
      <TooltipProvider>
        <div
          ref={progressRef}
          className="relative h-3 w-full cursor-pointer rounded-full bg-muted"
          onClick={handleProgressClick}
        >
          <div
            className="absolute top-0 end-0 h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${progress}%`,
              backgroundColor: "oklch(0.55 0.22 275)",
            }}
          />
          {/* Tag markers */}
          {tags.map((tag) => {
            if (tag.timestamp == null || !duration) return null;
            const pct = (tag.timestamp / duration) * 100;
            return (
              <Tooltip key={tag.id}>
                <TooltipTrigger
                  render={<button type="button" />}
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-background cursor-pointer z-10 hover:scale-150 transition-transform"
                  style={{
                    right: `${pct}%`,
                    backgroundColor: tag.color,
                    transform: `translate(50%, -50%)`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(tag.timestamp!);
                  }}
                />
                <TooltipContent side="top">{tag.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => skip(5)} title={HE.player.forward}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => skip(-5)} title={HE.player.rewind}>
            <SkipBack className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <button
            onClick={cycleRate}
            className="rounded-md px-2 py-0.5 font-mono text-xs hover:bg-muted transition-colors"
          >
            {playbackRate}x
          </button>
          <span className="font-mono tabular-nums" dir="ltr">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
