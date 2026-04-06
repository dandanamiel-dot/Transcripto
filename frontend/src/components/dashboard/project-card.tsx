"use client";

import Link from "next/link";
import { Clock, FileAudio } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HE, STATUS_COLORS } from "@/lib/constants";

interface Project {
  id: number;
  title: string;
  original_filename: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

export function ProjectCard({ project }: { project: Project }) {
  const statusLabel =
    HE.status[project.status as keyof typeof HE.status] ?? project.status;
  const statusColor = STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-700";

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileAudio className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">
                {project.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {project.original_filename}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className={statusColor}>
            {statusLabel}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(project.duration_seconds)}
            </span>
            <span>{formatDate(project.created_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
