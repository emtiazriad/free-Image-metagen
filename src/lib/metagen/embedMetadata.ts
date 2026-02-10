import type { MetaGenOutput } from "./types";
import { embedJpegMetadata, isJpegFile, type EmbedMetadataInput } from "./jpegMetadata";
import { embedPngMetadata, isPngFile } from "./pngMetadata";
import { embedWebpMetadata, isWebpFile } from "./webpMetadata";
import { embedSvgMetadata, isSvgFile } from "./svgMetadata";
import { embedGifMetadata, isGifFile } from "./gifMetadata";

export type EmbedSettings = {
  enabled: boolean;
  embedTitle: boolean;
  embedDescription: boolean;
  embedKeywords: boolean;
  embedCopyright: boolean;
  copyrightText: string;
  renameWithTitle: boolean;
  preset: EmbedPreset;
};

export type EmbedPreset = 
  | "custom"
  | "adobe_stock"
  | "shutterstock"
  | "getty_images"
  | "freepik"
  | "istock";

export const defaultEmbedSettings: EmbedSettings = {
  enabled: false,
  embedTitle: true,
  embedDescription: true,
  embedKeywords: true,
  embedCopyright: false,
  copyrightText: "",
  renameWithTitle: false,
  preset: "custom",
};

// Preset configurations for different stock platforms
export const embedPresets: Record<EmbedPreset, Partial<EmbedSettings>> = {
  custom: {},
  adobe_stock: {
    embedTitle: true,
    embedDescription: true,
    embedKeywords: true,
    embedCopyright: true,
  },
  shutterstock: {
    embedTitle: true,
    embedDescription: true,
    embedKeywords: true,
    embedCopyright: false,
  },
  getty_images: {
    embedTitle: true,
    embedDescription: true,
    embedKeywords: true,
    embedCopyright: true,
  },
  freepik: {
    embedTitle: true,
    embedDescription: true,
    embedKeywords: true,
    embedCopyright: false,
  },
  istock: {
    embedTitle: true,
    embedDescription: true,
    embedKeywords: true,
    embedCopyright: true,
  },
};

// Sanitize filename for SEO-friendly naming (keeps full title)
export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Embed metadata into JPEG image using client-side processing
export async function embedMetadataIntoImage(
  file: File,
  output: MetaGenOutput,
  settings: EmbedSettings
): Promise<{ blob: Blob; filename: string; embedded: boolean }> {
  const originalName = file.name;
  const ext = originalName.toLowerCase().split(".").pop() || "";
  
  // Determine new filename
  let newFilename = originalName;
  if (settings.renameWithTitle && output.title) {
    const sanitized = sanitizeFilename(output.title);
    if (sanitized) {
      newFilename = `${sanitized}.${ext === "jpeg" ? "jpg" : ext}`;
    }
  }

  if (!settings.enabled) {
    const arrayBuffer = await file.arrayBuffer();
    return {
      blob: new Blob([arrayBuffer], { type: file.type }),
      filename: newFilename,
      embedded: false,
    };
  }

  try {
    // Prepare metadata for embedding
    const metadata: EmbedMetadataInput = {} as EmbedMetadataInput;

    if (settings.embedTitle && output.title) {
      metadata.title = output.title;
    }
    if (settings.embedDescription && output.description) {
      metadata.description = output.description;
    }
    if (output.altText) {
      metadata.altText = output.altText;
    }

    
   // Build keyword list from keywords + categories
if (settings.embedKeywords) {
  const kw = output.keywords ? output.keywords.split(",") : [];
  const cats = output.categories ? output.categories.split(",") : [];

  const merged = [...kw, ...cats]
    .map(k => k.trim())
    .filter(Boolean);

  if (merged.length) {
    // Remove duplicates
    metadata.keywords = [...new Set(merged)].join(", ");
  }
}

    
    // Determine format and embed
    let result: Uint8Array | null = null;
    let mimeType = file.type;
    
    if (isJpegFile(file)) {
      result = await embedJpegMetadata(file, metadata);
      mimeType = "image/jpeg";
    } else if (isPngFile(file)) {
      result = await embedPngMetadata(file, metadata);
      mimeType = "image/png";
    } else if (isWebpFile(file)) {
      result = await embedWebpMetadata(file, metadata);
      mimeType = "image/webp";
    } else if (isSvgFile(file)) {
      result = await embedSvgMetadata(file, metadata);
      mimeType = "image/svg+xml";
    } else if (isGifFile(file)) {
      result = await embedGifMetadata(file, metadata);
      mimeType = "image/gif";
    }
    
    if (!result) {
      const arrayBuffer = await file.arrayBuffer();
      return {
        blob: new Blob([arrayBuffer], { type: file.type }),
        filename: newFilename,
        embedded: false,
      };
    }

    return {
      blob: new Blob([new Uint8Array(result)], { type: mimeType }),
      filename: newFilename,
      embedded: true,
    };
  } catch (error) {
    console.warn("Failed to embed metadata, returning original file:", error);
    const arrayBuffer = await file.arrayBuffer();
    return {
      blob: new Blob([arrayBuffer], { type: file.type }),
      filename: newFilename,
      embedded: false,
    };
  }
}

// Download a single image with embedded metadata
export async function downloadImageWithMetadata(
  file: File,
  output: MetaGenOutput,
  settings: EmbedSettings
): Promise<void> {
  const { blob, filename } = await embedMetadataIntoImage(file, output, settings);
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Download multiple images as individual files (with metadata embedded)
export async function downloadAllImagesWithMetadata(
  items: Array<{ file: File; output: MetaGenOutput }>,
  settings: EmbedSettings,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const { file, output } = items[i];
    onProgress?.(i + 1, items.length);
    await downloadImageWithMetadata(file, output, settings);
    // Small delay to prevent browser blocking multiple downloads
    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
