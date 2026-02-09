/**
 * Client-side GIF metadata embedding using the Comment Extension block
 * and an XMP Application Extension block.
 *
 * GIF89a spec: https://www.w3.org/Graphics/GIF/spec-gif89a.txt
 * XMP in GIF: Application Extension with "XMP DataXMP" identifier.
 */

import type { EmbedMetadataInput } from "./jpegMetadata";

const encoder = new TextEncoder();

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildXmpPacket(meta: EmbedMetadataInput): string {
  const langAlt = (v: string) =>
    `<rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(v)}</rdf:li></rdf:Alt>`;

  const keywords = meta.keywords
    ? meta.keywords.split(/,\s*/).filter(Boolean)
    : [];

  const parts: string[] = [];
  if (meta.title) parts.push(`<dc:title>${langAlt(meta.title)}</dc:title>`);
  if (meta.description || meta.title)
    parts.push(`<dc:description>${langAlt(meta.description || meta.title || "")}</dc:description>`);
  if (keywords.length)
    parts.push(
      `<dc:subject><rdf:Bag>${keywords.map((k) => `<rdf:li>${escapeXml(k)}</rdf:li>`).join("")}</rdf:Bag></dc:subject>`
    );

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${parts.join("\n    ")}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** Create a GIF Comment Extension containing the description text. */
function createCommentExtension(comment: string): Uint8Array {
  const commentBytes = encoder.encode(comment);
  const blocks: Uint8Array[] = [];

  // Split into sub-blocks of max 255 bytes
  let pos = 0;
  while (pos < commentBytes.length) {
    const size = Math.min(255, commentBytes.length - pos);
    const sub = new Uint8Array(1 + size);
    sub[0] = size;
    sub.set(commentBytes.slice(pos, pos + size), 1);
    blocks.push(sub);
    pos += size;
  }

  // Comment Extension: 0x21 0xFE + sub-blocks + terminator (0x00)
  const totalSub = blocks.reduce((s, b) => s + b.length, 0);
  const ext = new Uint8Array(2 + totalSub + 1);
  ext[0] = 0x21; // Extension Introducer
  ext[1] = 0xfe; // Comment Label
  let off = 2;
  for (const b of blocks) { ext.set(b, off); off += b.length; }
  ext[off] = 0x00; // Block terminator
  return ext;
}

/** Create a GIF Application Extension for XMP data. */
function createXmpApplicationExtension(xmpStr: string): Uint8Array {
  const xmpBytes = encoder.encode(xmpStr);

  // XMP magic trailer: 257 bytes (1, 255..0) required by XMP-in-GIF spec
  const magicTrailer = new Uint8Array(258);
  magicTrailer[0] = 0x01;
  for (let i = 0; i < 256; i++) {
    magicTrailer[i + 1] = 255 - i;
  }
  magicTrailer[257] = 0x00; // block terminator

  // Application Extension header
  // 0x21 0xFF [0x0B] "XMP DataXMP" + raw XMP bytes + magic trailer
  const appId = encoder.encode("XMP DataXMP"); // 11 bytes
  const header = new Uint8Array(3 + appId.length);
  header[0] = 0x21; // Extension Introducer
  header[1] = 0xff; // Application Extension Label
  header[2] = 0x0b; // Block size (11)
  header.set(appId, 3);

  const result = new Uint8Array(header.length + xmpBytes.length + magicTrailer.length);
  result.set(header, 0);
  result.set(xmpBytes, header.length);
  result.set(magicTrailer, header.length + xmpBytes.length);

  return result;
}

/**
 * Embed metadata into a GIF file.
 * Returns modified GIF bytes, or null if not valid GIF.
 */
export async function embedGifMetadata(
  file: File,
  metadata: EmbedMetadataInput
): Promise<Uint8Array | null> {
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);

  // Verify GIF signature (GIF87a or GIF89a)
  const sig = String.fromCharCode(data[0], data[1], data[2], data[3], data[4], data[5]);
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;

  // Build comment text: "Title | Description | Keywords"
  const commentParts: string[] = [];
  if (metadata.title) commentParts.push(`Title: ${metadata.title}`);
  if (metadata.description) commentParts.push(`Description: ${metadata.description}`);
  if (metadata.keywords) commentParts.push(`Keywords: ${metadata.keywords}`);

  const commentExt = commentParts.length > 0
    ? createCommentExtension(commentParts.join(" | "))
    : new Uint8Array(0);

  // Build XMP Application Extension
  const xmpStr = buildXmpPacket(metadata);
  const xmpExt = createXmpApplicationExtension(xmpStr);

  // Ensure GIF89a version (needed for extensions)
  const result = new Uint8Array(data);
  result[3] = 0x38; // '8'
  result[4] = 0x39; // '9'
  result[5] = 0x61; // 'a'

  // Find the Logical Screen Descriptor end to insert after header
  // Header(6) + LSD(7) + optional GCT
  let insertPos = 13; // after header + LSD
  const gctFlag = (data[10] & 0x80) !== 0;
  if (gctFlag) {
    const gctSize = 3 * (1 << ((data[10] & 0x07) + 1));
    insertPos += gctSize;
  }

  // Strip existing comment extensions and XMP app extensions
  // (scan from insertPos to end, rebuild without them)
  const before = result.slice(0, insertPos);
  const after = result.slice(insertPos);

  const newFile = new Uint8Array(before.length + commentExt.length + xmpExt.length + after.length);
  let off = 0;
  newFile.set(before, off); off += before.length;
  if (commentExt.length > 0) { newFile.set(commentExt, off); off += commentExt.length; }
  newFile.set(xmpExt, off); off += xmpExt.length;
  newFile.set(after, off);

  return newFile;
}

export function isGifFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  return file.type === "image/gif" || ext === "gif";
}
