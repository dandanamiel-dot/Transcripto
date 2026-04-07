"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  Tag as TagIcon,
  Download,
  Sparkles,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/project/status-badge";
import { MediaPlayer } from "@/components/project/media-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type Project, type Segment, type Tag, type Engine } from "@/lib/api";
import { HE, TAG_CATEGORY_COLORS } from "@/lib/constants";
import { usePlayerStore } from "@/stores/player-store";
import { useTranscriptionStore } from "@/stores/transcription-store";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Find the active segment index for a given playback time. */
function findActiveSegment(segments: Segment[], time: number): number | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (time >= segments[i].start_time && time <= segments[i].end_time) {
      return segments[i].id;
    }
  }
  return null;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);

  const [project, setProject] = useState<Project | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [selectedEngine, setSelectedEngine] = useState("faster-whisper");

  // Inline editing state
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Player store
  const { currentTime, activeSegmentId, setActiveSegmentId, seekTo } =
    usePlayerStore();

  // Transcription progress store
  const txStore = useTranscriptionStore();

  // Active segment ref for auto-scroll
  const activeSegRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.projects.get(projectId),
      api.segments.list(projectId).catch(() => []),
      api.tags.list(projectId).catch(() => []),
      api.engines.list().catch(() => []),
    ])
      .then(([proj, segs, tgs, engs]) => {
        setProject(proj);
        setSegments(segs);
        setTags(tgs);
        setEngines(engs);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // Sync player time → active segment highlight
  useEffect(() => {
    const id = findActiveSegment(segments, currentTime);
    if (id !== activeSegmentId) {
      setActiveSegmentId(id);
    }
  }, [currentTime, segments, activeSegmentId, setActiveSegmentId]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegRef.current) {
      activeSegRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSegmentId]);

  const handleTranscribe = async () => {
    setTranscribing(true);
    txStore.reset();
    txStore.connect(projectId);
    try {
      await api.projects.transcribe(projectId, selectedEngine);
      const proj = await api.projects.get(projectId);
      setProject(proj);
    } catch {
      setTranscribing(false);
      txStore.reset();
    }
  };

  // When transcription completes via WS, refresh real data
  useEffect(() => {
    if (txStore.status === "complete") {
      (async () => {
        const [proj, segs] = await Promise.all([
          api.projects.get(projectId),
          api.segments.list(projectId),
        ]);
        setProject(proj);
        setSegments(segs);
        setTranscribing(false);
        txStore.reset();
      })();
    } else if (txStore.status === "error") {
      setTranscribing(false);
    }
  }, [txStore.status, projectId, txStore]);

  const handleAutoTag = async () => {
    try {
      const newTags = await api.tags.autoTag(projectId);
      setTags((prev) => [...prev, ...newTags]);
    } catch {
      // handle error
    }
  };

  // --- Inline segment editing ---
  const startEditing = useCallback((seg: Segment) => {
    setEditingSegmentId(seg.id);
    setEditText(seg.text);
    setTimeout(() => editRef.current?.focus(), 0);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSegmentId(null);
    setEditText("");
  }, []);

  const saveEditing = useCallback(
    async (segmentId: number) => {
      const trimmed = editText.trim();
      if (!trimmed) return;

      // Optimistic update
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, text: trimmed } : s)),
      );
      setEditingSegmentId(null);

      try {
        await api.segments.update(projectId, segmentId, trimmed);
      } catch {
        // Revert on error — re-fetch
        const segs = await api.segments.list(projectId);
        setSegments(segs);
      }
    },
    [editText, projectId],
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent, segmentId: number) => {
      if (e.key === "Escape") {
        cancelEditing();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveEditing(segmentId);
      }
    },
    [cancelEditing, saveEditing],
  );

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const hasAudio = !!project.audio_path;
  const hasTranscript = segments.length > 0;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Breadcrumb & header */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/projects" className="hover:text-foreground">
              {HE.project.allProjects}
            </Link>
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            <span className="text-foreground">{project.title}</span>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <StatusBadge status={project.status} />
            </div>
            <div className="flex gap-2 items-center">
              {(project.status === "uploaded" || project.status === "transcribed") &&
                engines.length > 0 && (
                  <select
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value)}
                    disabled={transcribing}
                    className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {engines.map((eng) => (
                      <option
                        key={eng.name}
                        value={eng.name}
                        disabled={!eng.available}
                      >
                        {eng.label_he}
                        {!eng.available ? ` (${HE.engines.unavailable})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              {(project.status === "uploaded" || project.status === "transcribed") && (
                <Button onClick={handleTranscribe} disabled={transcribing}>
                  <Play className="h-4 w-4 me-2" />
                  {transcribing ? HE.common.loading : HE.project.transcribe}
                </Button>
              )}
              {(project.status === "transcribed" ||
                project.status === "tagged") && (
                <Button variant="outline" onClick={handleAutoTag}>
                  <Sparkles className="h-4 w-4 me-2" />
                  {HE.project.autoTag}
                </Button>
              )}
              <Button variant="outline">
                <Download className="h-4 w-4 me-2" />
                {HE.project.export}
              </Button>
            </div>
          </div>

          {/* Media Player */}
          {hasAudio && (
            <div className="mb-6">
              <MediaPlayer projectId={projectId} />
            </div>
          )}

          {/* Transcription progress */}
          {transcribing && (
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-sm font-medium">
                    {txStore.status === "extracting_audio"
                      ? HE.transcript.extractingAudio
                      : txStore.status === "processing"
                        ? HE.transcript.transcribing
                        : HE.common.loading}
                  </span>
                  {txStore.liveSegments.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {txStore.liveSegments.length} {HE.transcript.segments}
                    </span>
                  )}
                </div>
                {txStore.liveSegments.length > 0 && (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {txStore.liveSegments.map((seg) => (
                        <div
                          key={seg.segment_index}
                          className="flex gap-3 rounded-md p-2 text-sm bg-muted/30"
                        >
                          <span className="shrink-0 text-xs font-mono text-muted-foreground">
                            {formatTime(seg.start_time)}
                          </span>
                          <p className="text-sm">{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Transcript */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{HE.transcript.title}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {segments.length} {HE.transcript.segments}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasTranscript ? (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-1">
                        {segments.map((seg) => {
                          const isActive = seg.id === activeSegmentId;
                          const isEditing = seg.id === editingSegmentId;

                          return (
                            <div
                              key={seg.id}
                              ref={isActive ? activeSegRef : undefined}
                              className={`group flex gap-3 rounded-lg p-3 transition-colors ${
                                isActive
                                  ? "bg-purple-50 dark:bg-purple-950/30 border-r-2"
                                  : "hover:bg-muted/50"
                              }`}
                              style={
                                isActive
                                  ? { borderRightColor: "oklch(0.55 0.22 275)" }
                                  : undefined
                              }
                            >
                              {/* Timestamp — clickable to seek */}
                              <button
                                onClick={() => seekTo(seg.start_time)}
                                className="shrink-0 text-xs font-mono text-muted-foreground pt-0.5 hover:text-foreground transition-colors"
                              >
                                {formatTime(seg.start_time)}
                              </button>
                              <Separator
                                orientation="vertical"
                                className="h-auto"
                              />

                              {/* Text — editable */}
                              {isEditing ? (
                                <div className="flex-1 flex flex-col gap-2">
                                  <textarea
                                    ref={editRef}
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) =>
                                      handleEditKeyDown(e, seg.id)
                                    }
                                    className="w-full rounded-md border bg-background p-2 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    rows={3}
                                    dir="rtl"
                                  />
                                  <div className="flex gap-1 justify-start">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      onClick={() => saveEditing(seg.id)}
                                    >
                                      <Check className="h-3.5 w-3.5 me-1" />
                                      {HE.common.save}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      onClick={cancelEditing}
                                    >
                                      <X className="h-3.5 w-3.5 me-1" />
                                      {HE.common.cancel}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-1 flex items-start gap-2">
                                  <p
                                    className="text-sm leading-relaxed flex-1 cursor-pointer"
                                    onDoubleClick={() => startEditing(seg)}
                                  >
                                    {seg.text}
                                  </p>
                                  <button
                                    onClick={() => startEditing(seg)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                                    title={HE.project.edit}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-muted-foreground">
                        {HE.transcript.noTranscript}
                      </p>
                      {project.status === "uploaded" && (
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={handleTranscribe}
                          disabled={transcribing}
                        >
                          <Play className="h-4 w-4 me-2" />
                          {HE.transcript.startTranscription}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tags sidebar */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TagIcon className="h-4 w-4" />
                      {HE.tags.title}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {tags.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tags.length > 0 ? (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2">
                        {tags.map((tag) => (
                          <div
                            key={tag.id}
                            className="rounded-lg border p-3 space-y-1 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              if (tag.timestamp != null) seekTo(tag.timestamp);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {tag.label}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-xs"
                                style={{
                                  backgroundColor: tag.category
                                    ? `${TAG_CATEGORY_COLORS[tag.category]}20`
                                    : undefined,
                                  color: tag.category
                                    ? TAG_CATEGORY_COLORS[tag.category]
                                    : undefined,
                                }}
                              >
                                {tag.category
                                  ? HE.tags[
                                      tag.category as keyof typeof HE.tags
                                    ]
                                  : tag.tag_type === "auto"
                                    ? HE.tags.auto
                                    : HE.tags.manual}
                              </Badge>
                            </div>
                            {tag.timestamp != null && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {formatTime(tag.timestamp)}
                              </p>
                            )}
                            {tag.notes && (
                              <p className="text-xs text-muted-foreground">
                                {tag.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {HE.tags.addTag}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
