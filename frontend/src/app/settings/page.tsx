"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HE } from "@/lib/constants";

export default function SettingsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <h1 className="text-2xl font-bold mb-6">{HE.nav.settings}</h1>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">{HE.project.engine}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                faster-whisper (local)
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
