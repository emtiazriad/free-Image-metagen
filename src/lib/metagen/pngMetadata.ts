/**
 * Client-side PNG metadata embedding using iTXt (international text) chunks.
 * PNG spec: http://www.w3.org/TR/PNG/#11iTXt
 *
 * Standard keyword mappings:
 *   Title       -> iTXt "Title"
 *   Description -> iTXt "Description"
 *   Comment     -> iTXt "Comment" (keywords as comma-separated)
 *   Author      -> iTXt "Author"
 *
 * Additionally embeds XMP in an iTXt chunk keyed "XML:com.adobe.xmp" for
 * broader compatibility with Adobe tools and stock platforms.
 */

import type { EmbedMetadataInput } from "./jpegMetadata";

// ---- helpers ---------------------------------------------------------------

const encoder = new TextEncoder();

/** CRC-32 lookup table (IEEE polynomial) */
const crcTable: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a single PNG iTXt chunk. */
function createITXtChunk(keyword: string, text: string): Uint8Array {
  // iTXt layout: keyword(NUL) compressionFlag(0) compressionMethod(0)
  //              languageTag(NUL) translatedKeyword(NUL) text
  const kwBytes = encoder.encode(keyword);
  const txtBytes = encoder.encode(text);
  const dataLen = kwBytes.length + 1 + 1 + 1 + 1 + 1 + txtBytes.length;

  const chunkData = new Uint8Array(dataLen);
  let off = 0;
  chunkData.set(kwBytes, off); off += kwBytes.length;
  chunkData[off++] = 0; // NUL separator after keyword
  chunkData[off++] = 0; // compression flag (0 = uncompressed)
  chunkData[off++] = 0; // compression method
  chunkData[off++] = 0; // language tag (empty) NUL
  chunkData[off++] = 0; // translated keyword (empty) NUL
  chunkData.set(txtBytes, off);

  return buildChunk("iTXt", chunkData);
}

/** Wrap chunk data in length + type + data + CRC. */
function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  // Length (4 bytes big-endian)
  const len = data.length;
  chunk[0] = (len >>> 24) & 0xff;
  chunk[1] = (len >>> 16) & 0xff;
  chunk[2] = (len >>> 8) & 0xff;
  chunk[3] = len & 0xff;
  // Type
  chunk.set(typeBytes, 4);
  // Data
  chunk.set(data, 8);
  // CRC over type+data
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  const c = crc32(crcInput);
  const crcOff = 8 + data.length;
  chunk[crcOff] = (c >>> 24) & 0xff;
  chunk[crcOff + 1] = (c >>> 16) & 0xff;
  chunk[crcOff + 2] = (c >>> 8) & 0xff;
  chunk[crcOff + 3] = c & 0xff;
  return chunk;
}

function buildXmpPacket(meta: EmbedMetadataInput): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const langAlt = (v: string) =>
    `<rdf:Alt><rdf:li xml:lang="x-default">${esc(v)}</rdf:li></rdf:Alt>`;

  const keywords = meta.keywords
    ? meta.keywords.split(/,\s*/).filter(Boolean)
    : [];

  const parts: string[] = [];
  if (meta.title) parts.push(`<dc:title>${langAlt(meta.title)}</dc:title>`);
  if (meta.description || meta.title)
    parts.push(`<dc:description>${langAlt(meta.description || meta.title || "")}</dc:description>`);
  if (keywords.length)
    parts.push(
      `<dc:subject><rdf:Bag>${keywords.map((k) => `<rdf:li>${esc(k)}</rdf:li>`).join("")}</rdf:Bag></dc:subject>`
    );
  if (meta.title) parts.push(`<photoshop:Headline>${esc(meta.title)}</photoshop:Headline>`);

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
    ${parts.join("\n    ")}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// ---- public API ------------------------------------------------------------

/**
 * Embed metadata into a PNG file.
 * Returns the modified PNG bytes, or null if not a valid PNG.
 */
export async function embedPngMetadata(
  file: File,
  metadata: EmbedMetadataInput
): Promise<Uint8Array | null> {
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);

  // Verify PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== sig[i]) return null;
  }

  // Build metadata chunks
  const chunks: Uint8Array[] = [];

  if (metadata.title) {
    chunks.push(createITXtChunk("Title", metadata.title));
  }
  if (metadata.description) {
    chunks.push(createITXtChunk("Description", metadata.description));
  }
  if (metadata.keywords) {
    chunks.push(createITXtChunk("Comment", metadata.keywords));
  }

  // XMP chunk for Adobe/stock platform compatibility
  const xmp = buildXmpPacket(metadata);
  chunks.push(createITXtChunk("XML:com.adobe.xmp", xmp));

  if (chunks.length === 0) return null;

  // Insert right after IHDR (the first chunk, always at offset 8)
  // IHDR chunk: 4 len + 4 type + len data + 4 crc
  const ihdrLen =
    ((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0;
  const insertPos = 8 + 4 + 4 + ihdrLen + 4; // after IHDR

  // Remove existing iTXt chunks with same keywords to avoid duplicates
  const before = data.slice(0, insertPos);
  const after = stripExistingTextChunks(data.slice(insertPos));

  const totalChunkLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(before.length + totalChunkLen + after.length);
  let off = 0;
  result.set(before, off); off += before.length;
  for (const c of chunks) { result.set(c, off); off += c.length; }
  result.set(after, off);

  return result;
}

/** Remove existing tEXt / iTXt / zTXt chunks so we don't duplicate. */
function stripExistingTextChunks(data: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [];
  let pos = 0;
  while (pos + 8 <= data.length) {
    const len = ((data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]) >>> 0;
    const type = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    const chunkTotal = 4 + 4 + len + 4;
    if (pos + chunkTotal > data.length) break;

    if (type !== "tEXt" && type !== "iTXt" && type !== "zTXt") {
      kept.push(data.slice(pos, pos + chunkTotal));
    }
    pos += chunkTotal;
  }

  const total = kept.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of kept) { result.set(c, off); off += c.length; }
  return result;
}

export function isPngFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  return file.type === "image/png" || ext === "png";
}

