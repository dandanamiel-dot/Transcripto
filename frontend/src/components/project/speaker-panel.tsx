"use client";

import { useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project, Segment } from "@/lib/api";
import {
  HE,
  speakerColor,
  speakerDefaultLabel,
  speakerLabel,
} from "@/lib/constants";

interface SpeakerStats {
  id: string;
  segmentCount: number;
  totalSeconds: number;
}

function formatMinSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SpeakerPanel({
  project,
  segments,
  onRename,
  onSeekToSpeaker,
}: {
  project: Project | null;
  segments: Segment[];
  onRename: (speakerId: string, name: string) => void;
  onSeekToSpeaker?: (firstSegmentStart: number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { stats, firstStartBySpeaker } = useMemo(() => {
    const byId = new Map<string, SpeakerStats>();
    const firstStart = new Map<string, number>();
    for (const seg of segments) {
      if (!seg.speaker) continue;
      const cur = byId.get(seg.speaker) ?? {
        id: seg.speaker,
        segmentCount: 0,
        totalSeconds: 0,
      };
      cur.segmentCount += 1;
      cur.totalSeconds += Math.max(0, seg.end_time - seg.start_time);
      byId.set(seg.speaker, cur);
      if (!firstStart.has(seg.speaker)) {
        firstStart.set(seg.speaker, seg.start_time);
      }
    }
    const ordered = Array.from(byId.values()).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    return { stats: ordered, firstStartBySpeaker: firstStart };
  }, [segments]);

  const startEditing = (speakerId: string) => {
    setEditing(speakerId);
    setDraft(project?.speaker_names?.[speakerId] ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = (speakerId: string) => {
    onRename(speakerId, draft.trim());
    setEditing(null);
    setDraft("");
  };

  const onKeyDown = (e: React.KeyboardEvent, speakerId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(speakerId);
    } else if (e.key === "Escape") {
      setEditing(null);
      setDraft("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {HE.transcript.speakers}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {stats.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            {HE.transcript.noSpeakers}
          </p>
        ) : (
          <ul className="space-y-2">
            {stats.map((sp) => {
              const color = speakerColor(sp.id);
              const isEditing = editing === sp.id;
              const firstStart = firstStartBySpeaker.get(sp.id);
              return (
                <li
                  key={sp.id}
                  className="rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => onKeyDown(e, sp.id)}
                        onBlur={() => commit(sp.id)}
                        placeholder={speakerDefaultLabel(sp.id)}
                        dir="rtl"
                        className="h-6 flex-1 rounded border bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    ) : (
                      <button
                        onClick={() => startEditing(sp.id)}
                        onDoubleClick={() => {
                          if (firstStart != null && onSeekToSpeaker) {
                            onSeekToSpeaker(firstStart);
                          }
                        }}
                        className="flex-1 text-right text-sm font-medium cursor-pointer hover:text-purple-600 transition-colors"
                        title={HE.transcript.renameSpeaker}
                        style={{ color }}
                      >
                        {speakerLabel(sp.id, project?.speaker_names)}
                      </button>
                    )}
                  </div>
                  <div className="mt-1 ps-[18px] flex gap-3 text-[11px] text-muted-foreground font-mono">
                    <span>
                      {sp.segmentCount} {HE.transcript.speakerSegments}
                    </span>
                    <span>·</span>
                    <span>{formatMinSec(sp.totalSeconds)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
