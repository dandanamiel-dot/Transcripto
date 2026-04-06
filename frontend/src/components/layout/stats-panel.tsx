"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HE } from "@/lib/constants";

interface StatsData {
  totalProjects: number;
  inProgress: number;
  completed: number;
}

export function StatsPanel({ stats }: { stats: StatsData }) {
  return (
    <aside className="hidden w-72 shrink-0 space-y-4 p-4 xl:block">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{HE.dashboard.stats}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatItem
            label={HE.dashboard.totalProjects}
            value={stats.totalProjects}
            color="bg-primary/10 text-primary"
          />
          <StatItem
            label={HE.dashboard.inProgress}
            value={stats.inProgress}
            color="bg-orange-100 text-orange-700"
          />
          <StatItem
            label={HE.dashboard.completed}
            value={stats.completed}
            color="bg-green-100 text-green-700"
          />
        </CardContent>
      </Card>
    </aside>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}
