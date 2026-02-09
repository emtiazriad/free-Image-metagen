import type { MetaGenOutput } from "./types";
import { embedJpegMetadata, isJpegFile, type EmbedMetadataInput } from "./jpegMetadata";

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

  // Only JPEG files can have IPTC metadata embedded
  const isJpeg = isJpegFile(file);
  
  if (!isJpeg || !settings.enabled) {
    // Return original file as blob for non-JPEG or if embedding disabled
    const arrayBuffer = await file.arrayBuffer();
    return {
      blob: new Blob([arrayBuffer], { type: file.type }),
      filename: newFilename,
      embedded: false,
    };
  }

  try {
    // Prepare metadata for client-side embedding
    const metadata: EmbedMetadataInput = {
      newFilename,
    } as EmbedMetadataInput & { newFilename?: string };

    if (settings.embedTitle && output.title) {
      metadata.title = output.title;
    }

    if (settings.embedDescription && output.description) {
      metadata.description = output.description;
    }

    // Always pass altText for XMP AltTextAccessibility
    if (output.altText) {
      metadata.altText = output.altText;
    }

    if (settings.embedKeywords && output.keywords) {
      metadata.keywords = output.keywords;
    }

    // Extract first word of category
    if (output.categories) {
      const firstWord = output.categories.split(/[\s,]+/)[0]?.trim();
      if (firstWord) {
        metadata.category = firstWord.slice(0, 3);
      }
    }

    // Embed metadata client-side
    const result = await embedJpegMetadata(file, metadata);
    
    if (!result) {
      // Invalid JPEG, return original
      const arrayBuffer = await file.arrayBuffer();
      return {
        blob: new Blob([arrayBuffer], { type: file.type }),
        filename: newFilename,
        embedded: false,
      };
    }

    return {
      blob: new Blob([new Uint8Array(result)], { type: "image/jpeg" }),
      filename: newFilename,
      embedded: true,
    };
  } catch (error) {
    console.warn("Failed to embed metadata, returning original file:", error);
    // Fallback: return original file
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
