import type { EmbedMetadataInput } from "./jpegMetadata";

const encoder = new TextEncoder();

/* ---------------- CRC32 ---------------- */

const crcTable: Uint32Array = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;

    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c;
  }

  return table;
})();

function crc32(data: Uint8Array): number {

  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/* ---------------- CHUNK BUILDER ---------------- */

function buildChunk(type: string, data: Uint8Array): Uint8Array {

  const typeBytes = encoder.encode(type);

  const chunk = new Uint8Array(4 + 4 + data.length + 4);

  const len = data.length;

  chunk[0] = (len >>> 24) & 255;
  chunk[1] = (len >>> 16) & 255;
  chunk[2] = (len >>> 8) & 255;
  chunk[3] = len & 255;

  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(typeBytes.length + data.length);

  crcInput.set(typeBytes);
  crcInput.set(data, typeBytes.length);

  const crc = crc32(crcInput);

  const crcOffset = 8 + data.length;

  chunk[crcOffset] = (crc >>> 24) & 255;
  chunk[crcOffset + 1] = (crc >>> 16) & 255;
  chunk[crcOffset + 2] = (crc >>> 8) & 255;
  chunk[crcOffset + 3] = crc & 255;

  return chunk;
}

/* ---------------- tEXt CHUNK ---------------- */

function createTextChunk(keyword: string, value: string): Uint8Array {

  const key = encoder.encode(keyword);
  const text = encoder.encode(value);

  const data = new Uint8Array(key.length + 1 + text.length);

  data.set(key, 0);
  data[key.length] = 0;
  data.set(text, key.length + 1);

  return buildChunk("tEXt", data);
}

/* ---------------- iTXt CHUNK ---------------- */

function createITXtChunk(keyword: string, text: string): Uint8Array {

  const key = encoder.encode(keyword);
  const value = encoder.encode(text);

  const data = new Uint8Array(
    key.length + 1 + 1 + 1 + 1 + 1 + value.length
  );

  let offset = 0;

  data.set(key, offset);
  offset += key.length;

  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;

  data.set(value, offset);

  return buildChunk("iTXt", data);
}

/* ---------------- XMP PACKET ---------------- */

function buildXMP(meta: EmbedMetadataInput): string {

  const keywords = meta.keywords
    ? meta.keywords
        .split(",")
        .map(k => `<rdf:li>${k.trim()}</rdf:li>`)
        .join("")
    : "";

  return `<?xpacket begin="﻿"?>

<x:xmpmeta xmlns:x="adobe:ns:meta/">

<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">

<rdf:Description rdf:about=""
xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">

<dc:title>
<rdf:Alt>
<rdf:li xml:lang="x-default">${meta.title || ""}</rdf:li>
</rdf:Alt>
</dc:title>

<dc:description>
<rdf:Alt>
<rdf:li xml:lang="x-default">${meta.description || ""}</rdf:li>
</rdf:Alt>
</dc:description>

<dc:subject>
<rdf:Bag>
${keywords}
</rdf:Bag>
</dc:subject>

<photoshop:Headline>${meta.title || ""}</photoshop:Headline>

</rdf:Description>

</rdf:RDF>

</x:xmpmeta>

<?xpacket end="w"?>`;
}

/* ---------------- REMOVE OLD METADATA ---------------- */

function stripTextChunks(data: Uint8Array): Uint8Array {

  const kept: Uint8Array[] = [];

  let pos = 0;

  while (pos + 8 <= data.length) {

    const len =
      ((data[pos] << 24) |
      (data[pos + 1] << 16) |
      (data[pos + 2] << 8) |
      data[pos + 3]) >>> 0;

    const type = String.fromCharCode(
      data[pos + 4],
      data[pos + 5],
      data[pos + 6],
      data[pos + 7]
    );

    const chunkSize = 12 + len;

    if (pos + chunkSize > data.length) break;

    if (
      type !== "tEXt" &&
      type !== "iTXt" &&
      type !== "zTXt"
    ) {
      kept.push(data.slice(pos, pos + chunkSize));
    }

    pos += chunkSize;
  }

  const total = kept.reduce((s, c) => s + c.length, 0);

  const result = new Uint8Array(total);

  let offset = 0;

  for (const c of kept) {
    result.set(c, offset);
    offset += c.length;
  }

  return result;
}

/* ---------------- MAIN EMBED FUNCTION ---------------- */

export async function embedPngMetadata(
  file: File,
  meta: EmbedMetadataInput
): Promise<Uint8Array | null> {

  const buffer = new Uint8Array(await file.arrayBuffer());

  const signature = [137,80,78,71,13,10,26,10];

  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== signature[i]) return null;
  }

  const chunks: Uint8Array[] = [];

  if (meta.title) {
    chunks.push(createTextChunk("Title", meta.title));
    chunks.push(createITXtChunk("Title", meta.title));
  }

  if (meta.description) {
    chunks.push(createTextChunk("Description", meta.description));
    chunks.push(createITXtChunk("Description", meta.description));
  }

  if (meta.keywords) {
    chunks.push(createTextChunk("Keywords", meta.keywords));
    chunks.push(createITXtChunk("Keywords", meta.keywords));
  }

  const xmp = buildXMP(meta);

  chunks.push(createITXtChunk("XML:com.adobe.xmp", xmp));

  const ihdrLen =
    ((buffer[8] << 24) |
    (buffer[9] << 16) |
    (buffer[10] << 8) |
    buffer[11]) >>> 0;

  const insertPos = 8 + 12 + ihdrLen;

  const before = buffer.slice(0, insertPos);

  const after = stripTextChunks(buffer.slice(insertPos));

  const totalChunksSize = chunks.reduce((s,c)=>s+c.length,0);

  const result = new Uint8Array(
    before.length + totalChunksSize + after.length
  );

  let offset = 0;

  result.set(before, offset);
  offset += before.length;

  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }

  result.set(after, offset);

  return result;
}

/* ---------------- FILE TYPE ---------------- */

export function isPngFile(file: File): boolean {

  const ext = file.name.toLowerCase().split(".").pop() || "";

  return file.type === "image/png" || ext === "png";
}
