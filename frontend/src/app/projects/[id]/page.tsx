"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  Tag as TagIcon,
  Download,
  Sparkles,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/project/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type Project, type Segment, type Tag } from "@/lib/api";
import { HE, TAG_CATEGORY_COLORS } from "@/lib/constants";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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

  useEffect(() => {
    Promise.all([
      api.projects.get(projectId),
      api.segments.list(projectId).catch(() => []),
      api.tags.list(projectId).catch(() => []),
    ])
      .then(([proj, segs, tgs]) => {
        setProject(proj);
        setSegments(segs);
        setTags(tgs);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      await api.projects.transcribe(projectId);
      // Refresh data after transcription starts
      const proj = await api.projects.get(projectId);
      setProject(proj);
    } finally {
      setTranscribing(false);
    }
  };

  const handleAutoTag = async () => {
    try {
      const newTags = await api.tags.autoTag(projectId);
      setTags((prev) => [...prev, ...newTags]);
    } catch {
      // handle error
    }
  };

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
            <div className="flex gap-2">
              {project.status === "uploaded" && (
                <Button onClick={handleTranscribe} disabled={transcribing}>
                  <Play className="h-4 w-4 me-2" />
                  {transcribing ? HE.common.loading : HE.project.transcribe}
                </Button>
              )}
              {(project.status === "transcribed" || project.status === "tagged") && (
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
                  {segments.length > 0 ? (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3">
                        {segments.map((seg) => (
                          <div
                            key={seg.id}
                            className="group flex gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                          >
                            <span className="shrink-0 text-xs font-mono text-muted-foreground pt-0.5">
                              {formatTime(seg.start_time)}
                            </span>
                            <Separator orientation="vertical" className="h-auto" />
                            <p className="text-sm leading-relaxed">{seg.text}</p>
                          </div>
                        ))}
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
                            className="rounded-lg border p-3 space-y-1"
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
                                  ? HE.tags[tag.category as keyof typeof HE.tags]
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
