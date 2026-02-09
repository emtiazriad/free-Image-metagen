import type { MetaGenOutput } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

// Embed metadata into JPEG image using edge function for IPTC support
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
  const isJpeg = ext === "jpg" || ext === "jpeg";
  
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
    // Prepare metadata for edge function
    const metadata: Record<string, string | undefined> = {
      newFilename,
    };

    if (settings.embedTitle && output.title) {
      metadata.title = output.title;
    }

    if (settings.embedDescription && output.description) {
      metadata.description = output.description;
    }

    if (settings.embedKeywords && output.keywords) {
      metadata.keywords = output.keywords;
    }

    // Extract first category if available
    if (output.categories) {
      const firstCategory = output.categories.split(",")[0]?.trim().slice(0, 3);
      if (firstCategory) {
        metadata.category = firstCategory;
      }
    }

    // Create form data for edge function
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify(metadata));

    // Call edge function using fetch directly for binary response
    const response = await fetch(`${SUPABASE_URL}/functions/v1/embed-metadata`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      console.warn("Edge function error, falling back to original file:", response.statusText);
      const arrayBuffer = await file.arrayBuffer();
      return {
        blob: new Blob([arrayBuffer], { type: file.type }),
        filename: newFilename,
        embedded: false,
      };
    }

    // Get the response as a blob
    const blob = await response.blob();
    const wasEmbedded = response.headers.get("X-Metadata-Embedded") === "true";

    return {
      blob,
      filename: newFilename,
      embedded: wasEmbedded,
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
