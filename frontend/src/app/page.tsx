"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderOpen, TrendingUp } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatsPanel } from "@/components/layout/stats-panel";
import { ProjectCard } from "@/components/dashboard/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Project, type DashboardStats } from "@/lib/api";
import { HE } from "@/lib/constants";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard
      .stats()
      .then(setStats)
      .catch(() => {
        setStats({
          total_projects: 0,
          in_progress: 0,
          completed: 0,
          recent_projects: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">
            {/* Welcome banner */}
            <div className="mb-8 rounded-xl bg-gradient-to-l from-primary/80 to-primary p-8 text-primary-foreground">
              <p className="text-sm font-medium opacity-90">Transcripto</p>
              <h1 className="mt-2 text-2xl font-bold">{HE.dashboard.welcome}</h1>
              <p className="mt-1 text-sm opacity-80">{HE.dashboard.subtitle}</p>
              <Link href="/projects/new">
                <Button
                  variant="secondary"
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 me-2" />
                  {HE.project.newProject}
                </Button>
              </Link>
            </div>

            {/* Stats cards row */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label={HE.dashboard.totalProjects}
                value={stats?.total_projects}
                loading={loading}
                icon={<FolderOpen className="h-5 w-5 text-primary" />}
              />
              <StatCard
                label={HE.dashboard.inProgress}
                value={stats?.in_progress}
                loading={loading}
                icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
              />
              <StatCard
                label={HE.dashboard.completed}
                value={stats?.completed}
                loading={loading}
                icon={<TrendingUp className="h-5 w-5 text-green-500" />}
              />
            </div>

            {/* Recent projects */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{HE.dashboard.recentProjects}</h2>
              <Link href="/projects" className="text-sm text-primary hover:underline">
                {HE.dashboard.viewAll}
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6 space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : stats && stats.recent_projects.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stats.recent_projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{HE.dashboard.noProjects}</p>
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

          <StatsPanel
            stats={{
              totalProjects: stats?.total_projects ?? 0,
              inProgress: stats?.in_progress ?? 0,
              completed: stats?.completed ?? 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-12" />
          ) : (
            <p className="text-2xl font-bold">{value ?? 0}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
