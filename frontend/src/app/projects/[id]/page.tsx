"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Play,
  Tag as TagIcon,
  Download,
  Sparkles,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Project, type Segment, type Tag, type Engine, type LlmProvider } from "@/lib/api";
import { HE, TAG_CATEGORY_COLORS, speakerColor, speakerLabel } from "@/lib/constants";
import { TagEditorDialog } from "@/components/project/tag-editor-dialog";
import { usePlayerStore } from "@/stores/player-store";
import { useTranscriptionStore } from "@/stores/transcription-store";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const listContainerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.02, delayChildren: 0.04 },
  },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

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
  const [diarizeEnabled, setDiarizeEnabled] = useState(false);
  const [llmProviders, setLlmProviders] = useState<LlmProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("groq");
  const [tagging, setTagging] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Tag editor dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

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
      api.llmProviders.list().catch(() => []),
    ])
      .then(([proj, segs, tgs, engs, providers]) => {
        setProject(proj);
        setSegments(segs);
        setTags(tgs);
        setEngines(engs);
        setLlmProviders(providers);
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
      await api.projects.transcribe(projectId, selectedEngine, diarizeEnabled);
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
      // Refresh project to get updated status; don't reset store so error stays visible
      api.projects.get(projectId).then(setProject).catch(() => {});
    }
  }, [txStore.status, projectId, txStore]);

  const handleAutoTag = async () => {
    setTagging(true);
    try {
      const newTags = await api.tags.autoTag(projectId, selectedProvider);
      // Replace auto tags (backend deletes old ones), keep manual tags
      setTags((prev) => [
        ...prev.filter((t) => t.tag_type !== "auto"),
        ...newTags,
      ]);
      const proj = await api.projects.get(projectId);
      setProject(proj);
    } catch {
      // handle error
    } finally {
      setTagging(false);
    }
  };

  const handleExport = async (format: "srt" | "vtt" | "txt" | "json" | "edl") => {
    if (exporting) return;
    setExporting(true);
    try {
      const { blob, filename } = await api.exports.create(projectId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(HE.export.exportError);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    try {
      await api.tags.delete(projectId, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      // handle error
    }
  };

  const handleTagSaved = (savedTag: Tag) => {
    setTags((prev) => {
      const exists = prev.find((t) => t.id === savedTag.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTag.id ? savedTag : t));
      }
      return [...prev, savedTag];
    });
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
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={diarizeEnabled}
                    onChange={(e) => setDiarizeEnabled(e.target.checked)}
                    disabled={transcribing}
                    className="h-4 w-4 rounded border-muted-foreground/30 accent-purple-500"
                  />
                  {HE.transcript.diarize}
                </label>
              )}
              {(project.status === "uploaded" || project.status === "transcribed") && (
                <Button onClick={handleTranscribe} disabled={transcribing}>
                  <Play className="h-4 w-4 me-2" />
                  {transcribing ? HE.common.loading : HE.project.transcribe}
                </Button>
              )}
              {(project.status === "transcribed" ||
                project.status === "tagged") &&
                llmProviders.length > 0 && (
                  <>
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      disabled={tagging}
                      className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {llmProviders.map((p) => (
                        <option
                          key={p.name}
                          value={p.name}
                          disabled={!p.available}
                        >
                          {p.label_he}
                          {!p.available ? ` (${HE.llmProviders.unavailable})` : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      onClick={handleAutoTag}
                      disabled={tagging}
                    >
                      <Sparkles className="h-4 w-4 me-2" />
                      {tagging ? HE.tags.autoTagging : HE.project.autoTag}
                    </Button>
                  </>
                )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={exporting || segments.length === 0}
                  render={<Button variant="outline" />}
                >
                  <Download className="h-4 w-4 me-2" />
                  {exporting ? HE.export.downloading : HE.project.export}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("srt")}>
                    {HE.export.formats.srt}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("vtt")}>
                    {HE.export.formats.vtt}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("txt")}>
                    {HE.export.formats.txt}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")}>
                    {HE.export.formats.json}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("edl")}>
                    {HE.export.formats.edl}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Media Player */}
          {hasAudio && (
            <div className="mb-6">
              <MediaPlayer projectId={projectId} tags={tags} />
            </div>
          )}

          {/* Transcription error */}
          {txStore.status === "error" && txStore.error && (
            <Card className="mb-6 border-red-200 dark:border-red-900">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {HE.transcript.transcriptionError}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  {txStore.error}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Transcription progress */}
          {transcribing && (
            <Card className="mb-6 border-purple-200 dark:border-purple-900/50 overflow-hidden">
              <CardContent className="py-5">
                {/* Steps indicator */}
                <div className="flex items-center gap-6 mb-5">
                  {(
                    [
                      { key: "extracting_audio", label: HE.transcript.extractingAudio },
                      { key: "processing", label: HE.transcript.transcribing },
                      ...(diarizeEnabled
                        ? ([{ key: "diarizing", label: HE.transcript.diarizing }] as const)
                        : []),
                    ] as const
                  ).map((step, i) => {
                    const isActive = txStore.status === step.key;
                    const order: string[] = [
                      "extracting_audio",
                      "processing",
                      "diarizing",
                      "complete",
                    ];
                    const currentIdx = order.indexOf(txStore.status);
                    const stepIdx = order.indexOf(step.key);
                    const isDone = currentIdx > stepIdx && stepIdx !== -1;
                    return (
                      <div key={step.key} className="flex items-center gap-2">
                        <div className="relative flex items-center justify-center">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                              isDone
                                ? "bg-purple-500 text-white"
                                : isActive
                                  ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 ring-2 ring-purple-500/50"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isDone ? "✓" : i + 1}
                          </div>
                          {isActive && (
                            <div className="absolute inset-0 rounded-full animate-ping bg-purple-500/20" />
                          )}
                        </div>
                        <span
                          className={`text-sm transition-colors duration-300 ${
                            isActive
                              ? "font-semibold text-foreground"
                              : isDone
                                ? "text-muted-foreground"
                                : "text-muted-foreground/60"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                {(() => {
                  const lastSeg = txStore.liveSegments[txStore.liveSegments.length - 1];
                  const progress =
                    txStore.status === "extracting_audio"
                      ? null
                      : txStore.duration && lastSeg
                        ? Math.min(
                            Math.round((lastSeg.end_time / txStore.duration) * 100),
                            99,
                          )
                        : 0;
                  return (
                    <div className="space-y-2">
                      <div dir="ltr" className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        {progress === null ? (
                          /* Indeterminate shimmer for audio extraction */
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              background:
                                "linear-gradient(90deg, transparent 0%, oklch(0.55 0.22 275 / 0.5) 50%, transparent 100%)",
                              animation: "shimmer 1.5s ease-in-out infinite",
                            }}
                          />
                        ) : (
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${progress}%`,
                              background:
                                "linear-gradient(90deg, oklch(0.55 0.22 275), oklch(0.65 0.20 280))",
                            }}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {txStore.liveSegments.length > 0
                            ? `${txStore.liveSegments.length} ${HE.transcript.segments}`
                            : txStore.status === "extracting_audio"
                              ? HE.transcript.extractingAudio
                              : HE.common.loading}
                        </span>
                        {progress !== null && progress > 0 && (
                          <span className="font-mono tabular-nums">
                            {progress}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Live segments feed */}
                {txStore.liveSegments.length > 0 && (
                  <ScrollArea className="h-[180px] mt-4">
                    <div className="space-y-1">
                      {txStore.liveSegments.map((seg, i) => (
                        <div
                          key={seg.segment_index}
                          className="flex gap-3 rounded-md p-2 text-sm bg-muted/30 animate-in fade-in slide-in-from-bottom-1 duration-300"
                          style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
                        >
                          <span className="shrink-0 text-xs font-mono text-muted-foreground pt-0.5">
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
                      <motion.div
                        className="space-y-1"
                        variants={listContainerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {segments.map((seg) => {
                          const isActive = seg.id === activeSegmentId;
                          const isEditing = seg.id === editingSegmentId;

                          return (
                            <motion.div
                              key={seg.id}
                              ref={isActive ? activeSegRef : undefined}
                              variants={listItemVariants}
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
                                  <div className="flex-1">
                                    {seg.speaker && (
                                      <span
                                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold me-2 align-middle"
                                        style={{
                                          backgroundColor: `${speakerColor(seg.speaker)}20`,
                                          color: speakerColor(seg.speaker),
                                        }}
                                      >
                                        {speakerLabel(seg.speaker)}
                                      </span>
                                    )}
                                    <p
                                      className="inline text-sm leading-relaxed cursor-pointer"
                                      onDoubleClick={() => startEditing(seg)}
                                    >
                                      {seg.text}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => startEditing(seg)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                                    title={HE.project.edit}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </motion.div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-normal text-muted-foreground">
                        {tags.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingTag(null);
                          setTagDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tags.length > 0 ? (
                    <ScrollArea className="h-[500px]">
                      <motion.div
                        className="space-y-2"
                        variants={listContainerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <AnimatePresence initial={false}>
                        {tags.map((tag) => (
                          <motion.div
                            key={tag.id}
                            layout
                            variants={listItemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="group rounded-lg border p-3 space-y-1 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              if (tag.timestamp != null) seekTo(tag.timestamp);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {tag.label}
                              </span>
                              <div className="flex items-center gap-1">
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTag(tag);
                                    setTagDialogOpen(true);
                                  }}
                                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTag(tag.id);
                                  }}
                                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
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
                          </motion.div>
                        ))}
                        </AnimatePresence>
                      </motion.div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {HE.tags.noTags}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingTag(null);
                          setTagDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 me-1" />
                        {HE.tags.addTag}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <TagEditorDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        projectId={projectId}
        segments={segments}
        tag={editingTag}
        onSave={handleTagSaved}
      />
    </div>
  );
}
