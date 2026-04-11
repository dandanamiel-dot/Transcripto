"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HE } from "@/lib/constants";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = value.trim();
    const target = pathname?.startsWith("/projects") ? pathname : "/projects";
    router.push(query ? `${target}?q=${encodeURIComponent(query)}` : target);
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <form onSubmit={submit} className="relative w-full max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={HE.nav.search}
          className="ps-10 bg-background"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </form>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
