import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import type { MetaGenOutput } from "@/lib/metagen/types";
import { emptyOutput } from "@/lib/metagen/types";

export function MetadataEditorDialog({
  open,
  onOpenChange,
  filename,
  previewUrl,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string | null;
  previewUrl: string | null;
  value: MetaGenOutput | null;
  onSave: (next: MetaGenOutput) => void;
}) {
  const initial = useMemo(() => value ?? { ...emptyOutput }, [value]);
  const [draft, setDraft] = useState<MetaGenOutput>(initial);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
  }, [open, initial]);

  const canEdit = Boolean(filename);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">Metadata editor</DialogTitle>
          <DialogDescription className="truncate">
            {filename ? filename : "Select a generated row to edit."}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="grid gap-5 md:grid-cols-[240px,1fr]">
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">PREVIEW</div>
            {previewUrl ? (
              <div className="overflow-hidden rounded-lg border bg-card">
                <img
                  src={previewUrl}
                  alt={filename ? `${filename} preview` : "Image preview"}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">No preview available.</div>
            )}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Textarea
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                rows={2}
                disabled={!canEdit}
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                rows={6}
                disabled={!canEdit}
              />
            </div>

            <div className="grid gap-2">
              <Label>Alt text</Label>
              <Textarea
                value={draft.altText}
                onChange={(e) => setDraft((p) => ({ ...p, altText: e.target.value }))}
                rows={2}
                disabled={!canEdit}
              />
            </div>

            <div className="grid gap-2">
              <Label>Keywords</Label>
              <Textarea
                value={draft.keywords}
                onChange={(e) => setDraft((p) => ({ ...p, keywords: e.target.value }))}
                rows={4}
                disabled={!canEdit}
              />
            </div>

            <div className="grid gap-2">
              <Label>Categories</Label>
              <Textarea
                value={draft.categories}
                onChange={(e) => setDraft((p) => ({ ...p, categories: e.target.value }))}
                rows={2}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="hero"
            disabled={!canEdit}
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
