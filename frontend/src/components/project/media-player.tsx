"use client";

import { useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaveformPlayer } from "@/components/project/waveform-player";
import { usePlayerStore } from "@/stores/player-store";
import { HE } from "@/lib/constants";
import type { Tag } from "@/lib/api";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
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
  const {
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    setPlaybackRate,
    seekTo,
    togglePlay,
  } = usePlayerStore();

  const skip = useCallback(
    (delta: number) => {
      const target = Math.max(0, Math.min(duration || 0, currentTime + delta));
      seekTo(target);
    },
    [currentTime, duration, seekTo],
  );

  const cycleRate = useCallback(() => {
    const idx = PLAYBACK_RATES.indexOf(playbackRate);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <WaveformPlayer projectId={projectId} tags={tags} />

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
