/**
 * Client-side SVG metadata embedding.
 * Inserts a <metadata> element containing Dublin Core (dc:) and
 * RDF metadata directly into the SVG XML.
 */

import type { EmbedMetadataInput } from "./jpegMetadata";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMetadataElement(meta: EmbedMetadataInput): string {
  const keywords = meta.keywords
    ? meta.keywords.split(/,\s*/).filter(Boolean)
    : [];

  const parts: string[] = [];

  if (meta.title)
    parts.push(`      <dc:title>${escapeXml(meta.title)}</dc:title>`);
  if (meta.description)
    parts.push(`      <dc:description>${escapeXml(meta.description)}</dc:description>`);
  if (keywords.length)
    parts.push(
      `      <dc:subject>\n        <rdf:Bag>\n${keywords
        .map((k) => `          <rdf:li>${escapeXml(k)}</rdf:li>`)
        .join("\n")}\n        </rdf:Bag>\n      </dc:subject>`
    );

  if (parts.length === 0) return "";

  return `<metadata>
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
           xmlns:dc="http://purl.org/dc/elements/1.1/">
    <rdf:Description rdf:about="">
${parts.join("\n")}
    </rdf:Description>
  </rdf:RDF>
</metadata>`;
}

/**
 * Embed metadata into an SVG file.
 * Returns modified SVG bytes, or null if not valid SVG.
 */
export async function embedSvgMetadata(
  file: File,
  metadata: EmbedMetadataInput
): Promise<Uint8Array | null> {
  const text = await file.text();

  // Basic SVG validation
  if (!text.includes("<svg") && !text.includes("<SVG")) return null;

  const metaBlock = buildMetadataElement(metadata);
  if (!metaBlock) return null;

  // Remove existing <metadata>...</metadata> blocks
  let result = text.replace(/<metadata[\s\S]*?<\/metadata>/gi, "");

  // Also update/add a <title> element for basic SVG title support
  if (metadata.title) {
    result = result.replace(/<title[\s\S]*?<\/title>/gi, "");
    const titleElement = `<title>${escapeXml(metadata.title)}</title>`;
    // Insert after opening <svg ...> tag
    result = result.replace(/(<svg[^>]*>)/i, `$1\n${titleElement}\n${metaBlock}\n`);
  } else {
    result = result.replace(/(<svg[^>]*>)/i, `$1\n${metaBlock}\n`);
  }

  return new TextEncoder().encode(result);
}

export function isSvgFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  return file.type === "image/svg+xml" || ext === "svg";
}
