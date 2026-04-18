"use client";

import { useEffect, useRef, useState } from "react";

import { BACKEND_URL } from "@/lib/constants";
import { usePlayerStore } from "@/stores/player-store";

const DRIFT_THRESHOLD = 0.25; // seconds — re-sync only on meaningful drift
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

export function isVideoFilename(name: string | null | undefined): boolean {
  return !!name && VIDEO_EXT.test(name);
}

/**
 * Muted <video> slaved to the WaveSurfer audio clock. The waveform player
 * remains the source of truth for currentTime / isPlaying / playbackRate;
 * this component only mirrors those onto the HTMLVideoElement.
 */
export function VideoPreview({ projectId }: { projectId: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  // Snap on every store tick when drift exceeds threshold.
  useEffect(() => {
    const unsubscribe = usePlayerStore.subscribe((state, prev) => {
      const video = videoRef.current;
      if (!video) return;

      if (state.currentTime !== prev.currentTime) {
        const drift = Math.abs(video.currentTime - state.currentTime);
        if (drift > DRIFT_THRESHOLD) {
          video.currentTime = state.currentTime;
        }
      }

      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }

      if (state.playbackRate !== prev.playbackRate) {
        video.playbackRate = state.playbackRate;
      }
    });

    return unsubscribe;
  }, []);

  // Seed state once metadata is loaded so a fresh mount inherits the store.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
      const { currentTime, isPlaying, playbackRate } = usePlayerStore.getState();
      video.currentTime = currentTime;
      video.playbackRate = playbackRate;
      if (isPlaying) video.play().catch(() => {});
    };

    video.addEventListener("loadedmetadata", handleMetadata);
    return () => video.removeEventListener("loadedmetadata", handleMetadata);
  }, []);

  return (
    <div
      dir="ltr"
      className="relative mx-auto w-full max-h-[60vh] overflow-hidden rounded-lg bg-black"
      style={{ aspectRatio }}
    >
      <video
        ref={videoRef}
        src={`${BACKEND_URL}/api/projects/${projectId}/video`}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
