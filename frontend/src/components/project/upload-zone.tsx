"use client";

import { useCallback, useState } from "react";
import { Upload, FileAudio, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
  "video/webm",
  "audio/webm",
  "audio/ogg",
];

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadZone({
  onFilesSelected,
  disabled,
  multiple = false,
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const setFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const next = multiple ? files : files.slice(0, 1);
      setSelectedFiles(next);
      onFilesSelected(next);
    },
    [multiple, onFilesSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) setFiles(files);
    },
    [setFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) setFiles(files);
    },
    [setFiles],
  );

  const removeFile = (idx: number) => {
    const next = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(next);
    onFilesSelected(next);
  };

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        dragActive && "border-primary bg-primary/5",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <CardContent className="p-0">
        {selectedFiles.length > 0 ? (
          <div className="p-4 space-y-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between rounded-md bg-muted/30 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileAudio className="h-6 w-6 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(idx)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {multiple && (
              <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed py-3 text-sm text-muted-foreground hover:bg-muted/30">
                + {HE.project.orClick}
                <input
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_TYPES.join(",")}
                  multiple
                  onChange={handleChange}
                />
              </label>
            )}
          </div>
        ) : (
          <label
            className="flex cursor-pointer flex-col items-center justify-center py-16 px-6"
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 text-muted-foreground/60 mb-4" />
            <p className="text-base font-medium">{HE.project.dragDrop}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {HE.project.orClick}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {HE.project.supportedFormats}
            </p>
            <input
              type="file"
              className="hidden"
              accept={ACCEPTED_TYPES.join(",")}
              multiple={multiple}
              onChange={handleChange}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}
