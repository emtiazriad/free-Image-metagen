import { useState } from "react";
import { Download, FileImage, Check, Archive } from "lucide-react";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { MetaGenOutput, EmbedPreset } from "@/lib/metagen/types";
import { embedPresets, embedMetadataIntoImage, type EmbedSettings } from "@/lib/metagen/embedMetadata";

type StockPlatform = Exclude<EmbedPreset, "custom">;

const STOCK_PLATFORMS: { value: StockPlatform; label: string }[] = [
  { value: "adobe_stock", label: "Adobe Stock" },
  { value: "shutterstock", label: "Shutterstock" },
  { value: "getty_images", label: "Getty Images" },
  { value: "freepik", label: "Freepik" },
  { value: "istock", label: "iStock" },
];

interface DownloadWithEmbeddingButtonProps {
  items: Array<{ file: File; output: MetaGenOutput }>;
  disabled?: boolean;
}

export function DownloadWithEmbeddingButton({ items, disabled }: DownloadWithEmbeddingButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<StockPlatform>("adobe_stock");
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  const handleDownload = async () => {
    if (!items.length) return;

    setIsDownloading(true);
    setProgress(0);
    setCompleted(false);
    setStatusMessage("");

    const presetSettings = embedPresets[selectedPlatform];
    const settings: EmbedSettings = {
      enabled: true,
      embedTitle: true,
      embedDescription: true,
      embedKeywords: true,
      embedCopyright: presetSettings.embedCopyright ?? false,
      copyrightText: "",
      renameWithTitle: true,
      preset: selectedPlatform,
    };

    try {
      const isMultiple = items.length > 1;
      
      if (isMultiple) {
        // Multiple files: embed all, then create ZIP
        const zip = new JSZip();
        const processedFiles: Array<{ blob: Blob; filename: string }> = [];

        // Phase 1: Embed metadata in all files
        setStatusMessage("Embedding metadata...");
        for (let i = 0; i < items.length; i++) {
          const { file, output } = items[i];
          setCurrentFile(file.name);
          setProgress(Math.round(((i) / items.length) * 50)); // 0-50% for embedding

          const result = await embedMetadataIntoImage(file, output, settings);
          processedFiles.push(result);
        }

        // Phase 2: Add all files to ZIP
        setStatusMessage("Creating ZIP archive...");
        setCurrentFile("");
        
        // Handle duplicate filenames
        const usedNames = new Map<string, number>();
        for (const { blob, filename } of processedFiles) {
          let finalName = filename;
          const count = usedNames.get(filename) || 0;
          if (count > 0) {
            const ext = filename.lastIndexOf('.');
            if (ext > 0) {
              finalName = `${filename.slice(0, ext)}-${count}${filename.slice(ext)}`;
            } else {
              finalName = `${filename}-${count}`;
            }
          }
          usedNames.set(filename, count + 1);
          zip.file(finalName, blob);
        }

        setProgress(75);
        setStatusMessage("Compressing...");

        // Generate ZIP
        const zipBlob = await zip.generateAsync({ 
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        }, (metadata) => {
          setProgress(75 + Math.round(metadata.percent * 0.25)); // 75-100% for compression
        });

        // Download ZIP
        const timestamp = new Date().toISOString().slice(0, 10);
        const zipFilename = `images-with-metadata-${timestamp}.zip`;
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        // Single file: download directly
        const { file, output } = items[0];
        setCurrentFile(file.name);
        setStatusMessage("Embedding metadata...");

        const { blob, filename } = await embedMetadataIntoImage(file, output, settings);
        setProgress(80);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      setProgress(100);
      setCompleted(true);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
      setCurrentFile("");
      setStatusMessage("");
    }
  };

  const handleClose = () => {
    if (!isDownloading) {
      setOpen(false);
      setProgress(0);
      setCompleted(false);
      setCurrentFile("");
      setStatusMessage("");
    }
  };

  const isMultiple = items.length > 1;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || items.length === 0}
        onClick={() => setOpen(true)}
      >
        <FileImage className="h-4 w-4" />
        <span className="hidden sm:inline ml-1">Download with Metadata</span>
        <span className="sm:hidden">Embed</span>
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Download Images with Metadata
            </DialogTitle>
            <DialogDescription>
              Select your target stock platform. Metadata will be embedded into each JPEG image.
            </DialogDescription>
          </DialogHeader>

          {!isDownloading && !completed ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Stock Platform</Label>
                <RadioGroup
                  value={selectedPlatform}
                  onValueChange={(v) => setSelectedPlatform(v as StockPlatform)}
                  className="grid gap-2"
                >
                  {STOCK_PLATFORMS.map(({ value, label }) => (
                    <div
                      key={value}
                      className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setSelectedPlatform(value)}
                    >
                      <RadioGroupItem value={value} id={value} />
                      <Label htmlFor={value} className="flex-1 cursor-pointer font-normal">
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
                <p><strong>{items.length}</strong> image(s) will be downloaded with embedded IPTC/XMP metadata.</p>
                {isMultiple && (
                  <p className="mt-1 flex items-center gap-1">
                    <Archive className="h-3 w-3" />
                    Files will be bundled into a single ZIP archive.
                  </p>
                )}
                <p className="mt-1">Non-JPEG files will be downloaded without embedded metadata.</p>
              </div>

              <Button
                type="button"
                variant="hero"
                className="w-full gap-2"
                onClick={handleDownload}
              >
                {isMultiple ? <Archive className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {isMultiple ? `Download ZIP (${items.length} images)` : "Download Image"}
              </Button>
            </div>
          ) : completed ? (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Download Complete</p>
                  <p className="text-sm text-muted-foreground">
                    {isMultiple 
                      ? `ZIP archive with ${items.length} images downloaded`
                      : `Image downloaded with ${STOCK_PLATFORMS.find((p) => p.value === selectedPlatform)?.label} metadata`
                    }
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{statusMessage || "Processing..."}</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                {currentFile && (
                  <p className="text-xs text-muted-foreground truncate">
                    File: {currentFile}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
