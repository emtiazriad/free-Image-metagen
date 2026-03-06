/**
 * Client-side PNG metadata embedding using iTXt (international text) chunks.
 * PNG spec: http://www.w3.org/TR/PNG/#11iTXt
 *
 * Standard keyword mappings:
 *   Title       -> iTXt "Title"
 *   Description -> iTXt "Description"
 *   Comment     -> iTXt "Comment" (keywords as comma-separated)
 *   XML:com.adobe.xmp -> XMP packet for Adobe compatibility
 */

// ---- types -----------------------------------------------------------------

export interface EmbedMetadataInput {
  title?: string;
  description?: string;
  altText?: string;
  keywords?: string;
  category?: string;
}

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

/**
 * Calculate CRC-32 for a byte array
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a complete PNG chunk with length, type, data, and CRC
 */
function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  
  // Length (4 bytes, big-endian)
  const len = data.length;
  chunk[0] = (len >>> 24) & 0xff;
  chunk[1] = (len >>> 16) & 0xff;
  chunk[2] = (len >>> 8) & 0xff;
  chunk[3] = len & 0xff;
  
  // Chunk type
  chunk.set(typeBytes, 4);
  
  // Chunk data
  chunk.set(data, 8);
  
  // CRC over type + data
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

/**
 * Create an iTXt chunk with the given keyword and text
 * 
 * iTXt structure:
 *   - Keyword (null-terminated)
 *   - Compression flag (0 = uncompressed)
 *   - Compression method (0)
 *   - Language tag (null-terminated, empty here)
 *   - Translated keyword (null-terminated, empty here)
 *   - Text (UTF-8)
 */
function createITXtChunk(keyword: string, text: string): Uint8Array {
  const kwBytes = encoder.encode(keyword);
  const txtBytes = encoder.encode(text);
  
  // Calculate total data length
  const dataLen = kwBytes.length + 1 + 1 + 1 + 1 + 1 + txtBytes.length;
  const chunkData = new Uint8Array(dataLen);
  
  let offset = 0;
  
  // Keyword (null-terminated)
  chunkData.set(kwBytes, offset);
  offset += kwBytes.length;
  chunkData[offset++] = 0; // NUL separator
  
  // Compression flag (0 = uncompressed)
  chunkData[offset++] = 0;
  
  // Compression method (0)
  chunkData[offset++] = 0;
  
  // Language tag (empty, null-terminated)
  chunkData[offset++] = 0;
  
  // Translated keyword (empty, null-terminated)
  chunkData[offset++] = 0;
  
  // Text content
  chunkData.set(txtBytes, offset);
  
  return buildChunk("iTXt", chunkData);
}

/**
 * Escape XML special characters for XMP
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build an XMP language alternative container
 */
function buildLangAlt(value: string): string {
  return `<rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt>`;
}

/**
 * Build XMP packet for comprehensive metadata support
 */
function buildXmpPacket(metadata: EmbedMetadataInput): string {
  const title = metadata.title?.trim();
  const description = metadata.description?.trim();
  const keywords = metadata.keywords
    ? metadata.keywords.split(/,\s*/).filter((k) => k.trim())
    : [];

  // Build XMP components
  const dcTitle = title ? `<dc:title>${buildLangAlt(title)}</dc:title>` : "";
  
  const dcDesc = (description || title) 
    ? `<dc:description>${buildLangAlt(description || title || "")}</dc:description>`
    : "";
  
  const dcSubject = keywords.length
    ? `<dc:subject><rdf:Bag>${keywords
        .map((k) => `<rdf:li>${escapeXml(k)}</rdf:li>`)
        .join("")}</rdf:Bag></dc:subject>`
    : "";
  
  const psHeadline = title ? `<photoshop:Headline>${escapeXml(title)}</photoshop:Headline>` : "";

  // Combine all components that have content
  const components = [dcTitle, dcDesc, dcSubject, psHeadline]
    .filter(comp => comp.length > 0)
    .join("\n    ");

  // Only return if there's actual metadata
  if (!components) return "";

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
    ${components}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Remove existing text chunks (tEXt/iTXt/zTXt) to avoid duplicates
 */
function stripExistingTextChunks(data: Uint8Array): Uint8Array {
  const keptChunks: Uint8Array[] = [];
  let pos = 0;
  
  while (pos + 8 <= data.length) {
    // Read chunk length (4 bytes, big-endian)
    const len = ((data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]) >>> 0;
    
    // Read chunk type (4 bytes)
    const type = String.fromCharCode(
      data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]
    );
    
    const chunkTotal = 4 + 4 + len + 4;
    
    // Safety check: ensure we don't go out of bounds
    if (pos + chunkTotal > data.length) break;

    // Keep all non-text chunks
    if (type !== "tEXt" && type !== "iTXt" && type !== "zTXt") {
      keptChunks.push(data.slice(pos, pos + chunkTotal));
    }
    
    pos += chunkTotal;
  }

  // If we didn't process all data (shouldn't happen with valid PNG), append the rest
  if (pos < data.length) {
    keptChunks.push(data.slice(pos));
  }

  // Combine all kept chunks
  const total = keptChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  
  for (const chunk of keptChunks) { 
    result.set(chunk, offset); 
    offset += chunk.length; 
  }
  
  return result;
}

// ---- public API ------------------------------------------------------------

/**
 * Embed metadata into a PNG file.
 * Returns the modified PNG bytes as Uint8Array, or null if not a valid PNG.
 */
export async function embedPngMetadata(
  file: File,
  metadata: EmbedMetadataInput
): Promise<Uint8Array | null> {
  // Read file data
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);

  // Verify PNG signature (first 8 bytes)
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== pngSignature[i]) return null;
  }

  // Clean and normalize metadata
  const title = metadata.title?.trim();
  const description = metadata.description?.trim();
  const keywords = metadata.keywords
    ? metadata.keywords.split(/,\s*/).filter((k) => k.trim())
    : [];

  // Build metadata chunks
  const chunks: Uint8Array[] = [];

  // Add standard iTXt chunks
  if (title) {
    chunks.push(createITXtChunk("Title", title));
  }
  
  if (description) {
    chunks.push(createITXtChunk("Description", description));
  }
  
  // Store keywords as comma-separated in Comment chunk
  if (keywords.length > 0) {
    chunks.push(createITXtChunk("Comment", keywords.join(", ")));
  }

  // XMP chunk for Adobe/stock platform compatibility
  const xmp = buildXmpPacket({
    title,
    description,
    keywords: keywords.join(", ")
  });
  
  if (xmp) {
    chunks.push(createITXtChunk("XML:com.adobe.xmp", xmp));
  }

  // If no metadata to add, return original
  if (chunks.length === 0) {
    return data;
  }

  // Find IHDR chunk (always starts at offset 8)
  // IHDR chunk structure: 4 bytes length + 4 bytes type + data + 4 bytes CRC
  const ihdrLen = 
    ((data[8] << 24) | (data[9] << 16) | (data[10] << 8) | data[11]) >>> 0;
  
  // Position after IHDR chunk (including its CRC)
  const insertPos = 8 + 4 + 4 + ihdrLen + 4;

  // Split the PNG data
  const beforeIHDR = data.slice(0, 8); // Just the signature
  const ihdrChunk = data.slice(8, insertPos); // The IHDR chunk itself
  const afterIHDR = data.slice(insertPos); // Everything after IHDR

  // Remove existing text chunks from the 'afterIHDR' portion
  const cleanedAfter = stripExistingTextChunks(afterIHDR);

  // Calculate total size
  const totalChunkLen = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(
    beforeIHDR.length + ihdrChunk.length + totalChunkLen + cleanedAfter.length
  );

  // Rebuild the PNG with proper chunk ordering
  let offset = 0;
  
  // 1. PNG signature
  result.set(beforeIHDR, offset);
  offset += beforeIHDR.length;
  
  // 2. IHDR chunk (must come first)
  result.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  
  // 3. New metadata chunks (inserted after IHDR, before any other chunks)
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  // 4. Rest of PNG chunks (with existing text chunks removed)
  result.set(cleanedAfter, offset);

  return result;
}

/**
 * Check if a file is a PNG by MIME type or extension
 */
export function isPngFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  return (
    file.type === "image/png" ||
    ext === "png"
  );
}

/**
 * Check if a buffer contains a valid PNG signature
 */
export function isPngBuffer(buffer: Uint8Array): boolean {
  if (buffer.length < 8) return false;
  
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngSignature[i]) return false;
  }
  
  return true;
}
