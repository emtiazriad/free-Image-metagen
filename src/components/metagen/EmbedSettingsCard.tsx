import { Download, FileImage, Tag } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import type { EmbedPreset, EmbedSettings } from "@/lib/metagen/embedMetadata";
import { embedPresets } from "@/lib/metagen/embedMetadata";

export function EmbedSettingsCard({
  settings,
  onSettingsChange,
}: {
  settings: EmbedSettings;
  onSettingsChange: (next: EmbedSettings | ((prev: EmbedSettings) => EmbedSettings)) => void;
}) {
  const handlePresetChange = (preset: EmbedPreset) => {
    const presetSettings = embedPresets[preset];
    onSettingsChange((prev) => ({
      ...prev,
      preset,
      ...presetSettings,
    }));
  };

  const handleFieldToggle = (field: keyof EmbedSettings, checked: boolean) => {
    onSettingsChange((prev) => ({
      ...prev,
      [field]: checked,
      preset: "custom", // Reset to custom when manually changing
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileImage className="h-4 w-4" /> Metadata Embedding
        </CardTitle>
        <CardDescription>
          Embed EXIF/XMP metadata into images for stock sites &amp; SEO.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="embed-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) =>
              onSettingsChange((prev) => ({ ...prev, enabled: checked === true }))
            }
          />
          <Label htmlFor="embed-enabled" className="font-medium cursor-pointer">
            Enable metadata embedding
          </Label>
        </div>

        {settings.enabled && (
          <>
            <Separator />

            {/* Platform preset */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" /> Platform preset
              </Label>
              <Select value={settings.preset} onValueChange={(v) => handlePresetChange(v as EmbedPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="adobe_stock">Adobe Stock</SelectItem>
                  <SelectItem value="shutterstock">Shutterstock</SelectItem>
                  <SelectItem value="getty_images">Getty Images</SelectItem>
                  <SelectItem value="freepik">Freepik</SelectItem>
                  <SelectItem value="istock">iStock</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pre-configured settings for popular stock platforms.
              </p>
            </div>

            {/* Field toggles */}
            <div className="space-y-3 rounded-lg border bg-background/40 p-3">
              <div className="text-xs font-medium text-muted-foreground">Fields to embed</div>
              
              <div className="grid gap-2.5">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="embed-title"
                    checked={settings.embedTitle}
                    onCheckedChange={(checked) => handleFieldToggle("embedTitle", checked === true)}
                  />
                  <Label htmlFor="embed-title" className="cursor-pointer">Title</Label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="embed-description"
                    checked={settings.embedDescription}
                    onCheckedChange={(checked) => handleFieldToggle("embedDescription", checked === true)}
                  />
                  <Label htmlFor="embed-description" className="cursor-pointer">Description</Label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="embed-keywords"
                    checked={settings.embedKeywords}
                    onCheckedChange={(checked) => handleFieldToggle("embedKeywords", checked === true)}
                  />
                  <Label htmlFor="embed-keywords" className="cursor-pointer">Keywords</Label>
                </div>

              </div>
            </div>

            {/* SEO rename option */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="rename-with-title"
                checked={settings.renameWithTitle}
                onCheckedChange={(checked) =>
                  onSettingsChange((prev) => ({ ...prev, renameWithTitle: checked === true }))
                }
              />
              <div>
                <Label htmlFor="rename-with-title" className="cursor-pointer">
                  Rename files with SEO title
                </Label>
                <p className="text-xs text-muted-foreground">
                  Uses sanitized title as filename for better SEO.
                </p>
              </div>
            </div>

            {/* Info about JPEG only */}
            <div className="rounded-md border border-muted bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <Download className="inline h-3.5 w-3.5 mr-1.5 align-text-bottom" />
              Metadata is embedded in JPEG files only. Other formats (PNG, WebP, GIF, SVG) are exported in original quality without embedded metadata.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
