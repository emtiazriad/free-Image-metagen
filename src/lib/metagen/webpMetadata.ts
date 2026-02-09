/**
 * Client-side WebP metadata embedding using RIFF XMP chunks.
 * WebP container spec: https://developers.google.com/speed/webp/docs/riff_container
 *
 * Embeds XMP metadata in an "XMP " RIFF chunk for compatibility with
 * Adobe tools and stock platforms.
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
  if (meta.title) parts.push(`<photoshop:Headline>${escapeXml(meta.title)}</photoshop:Headline>`);
  if (meta.altText)
    parts.push(
      `<Iptc4xmpExt:AltTextAccessibility>${langAlt(meta.altText)}</Iptc4xmpExt:AltTextAccessibility>`
    );

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">
    ${parts.join("\n    ")}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** Read a 32-bit little-endian value */
function readU32LE(d: Uint8Array, off: number): number {
  return (d[off] | (d[off + 1] << 8) | (d[off + 2] << 16) | (d[off + 3] << 24)) >>> 0;
}

/** Write a 32-bit little-endian value */
function writeU32LE(d: Uint8Array, off: number, v: number) {
  d[off] = v & 0xff;
  d[off + 1] = (v >>> 8) & 0xff;
  d[off + 2] = (v >>> 16) & 0xff;
  d[off + 3] = (v >>> 24) & 0xff;
}

/**
 * Embed XMP metadata into a WebP file.
 * Returns the modified WebP bytes, or null if not a valid WebP.
 */
export async function embedWebpMetadata(
  file: File,
  metadata: EmbedMetadataInput
): Promise<Uint8Array | null> {
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);

  // Verify RIFF....WEBP signature
  if (
    data.length < 12 ||
    data[0] !== 0x52 || data[1] !== 0x49 || data[2] !== 0x46 || data[3] !== 0x46 || // RIFF
    data[8] !== 0x57 || data[9] !== 0x45 || data[10] !== 0x42 || data[11] !== 0x50   // WEBP
  ) {
    return null;
  }

  const xmpStr = buildXmpPacket(metadata);
  const xmpBytes = encoder.encode(xmpStr);

  // Build XMP chunk: "XMP " + size(LE 4 bytes) + data + optional padding byte
  const xmpChunkSize = xmpBytes.length;
  const xmpPadded = xmpChunkSize % 2 !== 0 ? 1 : 0;
  const xmpChunk = new Uint8Array(8 + xmpChunkSize + xmpPadded);
  xmpChunk.set(encoder.encode("XMP "), 0);
  writeU32LE(xmpChunk, 4, xmpChunkSize);
  xmpChunk.set(xmpBytes, 8);

  // Strip existing XMP chunk if present, collect remaining chunks
  const chunks: Uint8Array[] = [];
  let pos = 12; // after RIFF header + WEBP
  while (pos + 8 <= data.length) {
    const chunkId = String.fromCharCode(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
    const chunkLen = readU32LE(data, pos + 4);
    const totalLen = 8 + chunkLen + (chunkLen % 2 !== 0 ? 1 : 0);

    if (pos + totalLen > data.length + 1) break; // safety

    if (chunkId !== "XMP ") {
      chunks.push(data.slice(pos, pos + totalLen));
    }
    pos += totalLen;
  }

  // Append our XMP chunk
  chunks.push(xmpChunk);

  // Rebuild RIFF file
  const bodyLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(12 + bodyLen);
  result.set(encoder.encode("RIFF"), 0);
  writeU32LE(result, 4, 4 + bodyLen); // file size minus 8, but includes "WEBP"
  result.set(encoder.encode("WEBP"), 8);

  let off = 12;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }

  return result;
}

export function isWebpFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  return file.type === "image/webp" || ext === "webp";
}
