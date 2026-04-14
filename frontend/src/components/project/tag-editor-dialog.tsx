"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api, type Tag, type Segment } from "@/lib/api";
import { HE, TAG_CATEGORY_COLORS } from "@/lib/constants";

const CATEGORIES = [
  "quote",
  "topic_change",
  "emotion",
  "keyword",
  "name_place",
] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseTime(str: string): number | null {
  const match = str.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

interface TagEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  segments: Segment[];
  tag?: Tag | null;
  onSave: (tag: Tag) => void;
}

export function TagEditorDialog({
  open,
  onOpenChange,
  projectId,
  segments,
  tag,
  onSave,
}: TagEditorDialogProps) {
  const isEdit = !!tag && tag.id !== 0;

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>("keyword");
  const [segmentId, setSegmentId] = useState<string>("");
  const [timestampStr, setTimestampStr] = useState("");
  const [endTimestampStr, setEndTimestampStr] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens or tag changes
  useEffect(() => {
    if (open) {
      if (tag) {
        setLabel(tag.label);
        setCategory(tag.category || "keyword");
        setSegmentId(tag.segment_id?.toString() || "");
        setTimestampStr(tag.timestamp != null ? formatTime(tag.timestamp) : "");
        setEndTimestampStr(
          tag.end_timestamp != null ? formatTime(tag.end_timestamp) : "",
        );
        setNotes(tag.notes || "");
      } else {
        setLabel("");
        setCategory("keyword");
        setSegmentId("");
        setTimestampStr("");
        setEndTimestampStr("");
        setNotes("");
      }
    }
  }, [open, tag]);

  // When segment selection changes, auto-fill timestamps
  const handleSegmentChange = (value: string) => {
    setSegmentId(value);
    const seg = segments.find((s) => s.id.toString() === value);
    if (seg) {
      setTimestampStr(formatTime(seg.start_time));
      setEndTimestampStr(formatTime(seg.end_time));
    }
  };

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);

    const timestamp = parseTime(timestampStr);
    const endTimestamp = parseTime(endTimestampStr);
    const color = TAG_CATEGORY_COLORS[category] || "#8B5CF6";

    try {
      if (isEdit && tag) {
        const updated = await api.tags.update(projectId, tag.id, {
          label: label.trim(),
          category,
          segment_id: segmentId ? parseInt(segmentId, 10) : null,
          timestamp,
          end_timestamp: endTimestamp,
          color,
          notes: notes.trim() || null,
        });
        onSave(updated);
      } else {
        const created = await api.tags.create(projectId, {
          label: label.trim(),
          tag_type: "manual",
          category,
          segment_id: segmentId ? parseInt(segmentId, 10) : null,
          timestamp,
          end_timestamp: endTimestamp,
          color,
          notes: notes.trim() || null,
        });
        onSave(created);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? HE.tags.editTag : HE.tags.addTag}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Label */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{HE.tags.label}</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              dir="rtl"
              placeholder={HE.tags.label}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{HE.tags.category}</label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: TAG_CATEGORY_COLORS[cat] }}
                    />
                    {HE.tags[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Segment */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{HE.tags.segment}</label>
            <Select value={segmentId} onValueChange={(v) => v && handleSegmentChange(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={HE.tags.selectSegment} />
              </SelectTrigger>
              <SelectContent>
                {segments.map((seg) => (
                  <SelectItem key={seg.id} value={seg.id.toString()}>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTime(seg.start_time)}
                    </span>
                    <span className="truncate max-w-[200px]">
                      {seg.text.slice(0, 40)}
                      {seg.text.length > 40 ? "..." : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {HE.tags.timestamp}
              </label>
              <Input
                value={timestampStr}
                onChange={(e) => setTimestampStr(e.target.value)}
                placeholder="00:00"
                dir="ltr"
                className="font-mono text-center"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {HE.tags.endTimestamp}
              </label>
              <Input
                value={endTimestampStr}
                onChange={(e) => setEndTimestampStr(e.target.value)}
                placeholder="00:00"
                dir="ltr"
                className="font-mono text-center"
              />
            </div>
          </div>

          {/* Color preview */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {HE.tags.category}:
            </span>
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{
                backgroundColor: TAG_CATEGORY_COLORS[category] || "#8B5CF6",
              }}
            />
            <span className="text-sm">
              {HE.tags[category as keyof typeof HE.tags] || category}
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{HE.tags.notes}</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              dir="rtl"
              rows={3}
              placeholder={HE.tags.notes}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !label.trim()}>
            {saving ? HE.common.loading : HE.common.save}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {HE.common.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
