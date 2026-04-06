"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Plus,
  Settings,
  FileAudio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, HE } from "@/lib/constants";
import { Separator } from "@/components/ui/separator";

const navItems = [
  {
    section: HE.nav.overview,
    items: [
      { href: "/", label: HE.nav.dashboard, icon: LayoutDashboard },
      { href: "/projects", label: HE.nav.projects, icon: FolderOpen },
    ],
  },
  {
    section: HE.nav.management,
    items: [
      { href: "/projects/new", label: HE.nav.newProject, icon: Plus },
      { href: "/settings", label: HE.nav.settings, icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-e border-border bg-card">
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <FileAudio className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navItems.map((section) => (
          <div key={section.section} className="mb-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.section}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
