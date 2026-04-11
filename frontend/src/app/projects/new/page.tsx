"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { UploadZone } from "@/components/project/upload-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { HE } from "@/lib/constants";
import { cn } from "@/lib/utils";

type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileProgress {
  name: string;
  status: FileStatus;
  error?: string;
  projectId?: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<FileProgress[]>([]);

  const isBatch = files.length > 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) return;

    setUploading(true);

    const initial: FileProgress[] = files.map((f) => ({
      name: f.name,
      status: "pending",
    }));
    setProgress(initial);

    const created: number[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p)),
      );

      try {
        const formData = new FormData();
        formData.append("file", file);
        const defaultTitle = file.name.replace(/\.[^.]+$/, "");
        // In single-file mode, respect the title/description fields.
        // In batch mode, use file basename for each.
        formData.append(
          "title",
          isBatch ? defaultTitle : title || defaultTitle,
        );
        if (!isBatch && description) {
          formData.append("description", description);
        }

        const project = await api.projects.create(formData);
        created.push(project.id);
        setProgress((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "done", projectId: project.id } : p,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setProgress((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "error", error: message } : p,
          ),
        );
      }
    }

    if (created.length === 0) {
      setUploading(false);
      return;
    }

    // Single success → jump directly to that project.
    if (created.length === 1 && files.length === 1) {
      router.push(`/projects/${created[0]}`);
      return;
    }

    // Batch → wait a beat so the user sees the completion state, then go to list.
    setTimeout(() => router.push("/projects"), 800);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <h1 className="text-2xl font-bold mb-6">{HE.project.newProject}</h1>

          <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
            <UploadZone
              onFilesSelected={setFiles}
              disabled={uploading}
              multiple
            />

            {!isBatch && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {HE.project.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder={HE.project.title}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={uploading}
                  />
                  <Textarea
                    placeholder={HE.project.description}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={uploading}
                  />
                </CardContent>
              </Card>
            )}

            {progress.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {HE.project.filesSelected} ({progress.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {progress.map((p, idx) => (
                    <div
                      key={`${p.name}-${idx}`}
                      className={cn(
                        "flex items-center justify-between rounded-md border p-3 text-sm",
                        p.status === "done" &&
                          "border-emerald-500/50 bg-emerald-500/5",
                        p.status === "error" &&
                          "border-red-500/50 bg-red-500/5",
                        p.status === "uploading" &&
                          "border-primary/50 bg-primary/5",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {p.status === "uploading" && (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        )}
                        {p.status === "done" && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        )}
                        {p.status === "error" && (
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                        )}
                        {p.status === "pending" && (
                          <div className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/30" />
                        )}
                        <span className="truncate">{p.name}</span>
                      </div>
                      {p.status === "error" && p.error && (
                        <span className="text-xs text-red-500 truncate max-w-[40%]">
                          {p.error}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={!files.length || uploading}>
                {uploading
                  ? HE.common.loading
                  : isBatch
                    ? `${HE.project.uploadFile} (${files.length})`
                    : HE.project.uploadFile}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={uploading}
              >
                {HE.common.cancel}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
