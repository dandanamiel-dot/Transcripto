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
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelected, disabled }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        dragActive && "border-primary bg-primary/5",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <CardContent className="p-0">
        {selectedFile ? (
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <FileAudio className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
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
              onChange={handleChange}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}
