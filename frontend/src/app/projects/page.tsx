"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, FolderOpen, Search } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProjectCard } from "@/components/dashboard/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Project } from "@/lib/api";
import { HE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  "uploaded",
  "processing",
  "transcribed",
  "tagged",
  "completed",
] as const;

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Re-sync from the URL when it changes (e.g. header search). This is the
  // canonical "derive state from props during render" pattern — cheaper and
  // safer than an effect with setState.
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        p.title,
        p.description ?? "",
        p.original_filename,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, query, statusFilter]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{HE.project.allProjects}</h1>
            <Link href="/projects/new">
              <Button>
                <Plus className="h-4 w-4 me-2" />
                {HE.project.newProject}
              </Button>
            </Link>
          </div>

          <div className="mb-6 space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={HE.project.searchProjects}
                className="ps-10 bg-background"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {HE.project.all}
              </button>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s === statusFilter ? null : s)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {HE.status[s as keyof typeof HE.status] ?? s}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <p className="text-lg text-muted-foreground">
                  {HE.project.noResults}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <p className="text-lg text-muted-foreground">
                  {HE.dashboard.noProjects}
                </p>
                <Link href="/projects/new">
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 me-2" />
                    {HE.dashboard.startFirst}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
