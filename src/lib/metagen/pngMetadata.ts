/**
 * Client-side PNG metadata embedding with full XMP support
 * Creates the same comprehensive metadata fields as JPEG implementation
 * Supports IPTC, EXIF, XMP, and basic PNG text chunks
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
  if (!text) return new Uint8Array(0);
  
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
 * Create a tEXt chunk (simpler format, better compatibility with older readers)
 */
function createTExtChunk(keyword: string, text: string): Uint8Array {
  if (!text) return new Uint8Array(0);
  
  const kwBytes = encoder.encode(keyword);
  const txtBytes = encoder.encode(text);
  
  // tEXt layout: keyword(NUL) text
  const dataLen = kwBytes.length + 1 + txtBytes.length;
  const chunkData = new Uint8Array(dataLen);
  
  let offset = 0;
  chunkData.set(kwBytes, offset);
  offset += kwBytes.length;
  chunkData[offset++] = 0; // NUL separator
  chunkData.set(txtBytes, offset);
  
  return buildChunk("tEXt", chunkData);
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
  if (!value) return "";
  return `<rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt>`;
}

/**
 * Create comprehensive XMP packet with ALL fields that JPEG supports
 * This ensures PNG shows the same metadata fields as JPEG
 */
function buildComprehensiveXmpPacket(metadata: EmbedMetadataInput): string {
  const title = metadata.title?.trim() || "";
  const description = metadata.description?.trim() || "";
  const altText = metadata.altText?.trim() || description || title;
  const category = metadata.category?.trim() || "";
  
  const keywords = metadata.keywords
    ? metadata.keywords.split(/,\s*/).filter((k) => k.trim())
    : [];
  
  // Build keywords bag
  const keywordsBag = keywords.length > 0
    ? `<rdf:Bag>
        ${keywords.map(k => `<rdf:li>${escapeXml(k)}</rdf:li>`).join("\n        ")}
      </rdf:Bag>`
    : "";

  // Build comprehensive XMP with all fields that JPEG supports
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
    xmlns:iptc="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/">
    
    <!-- Dublin Core fields (matches JPEG XMP) -->
    ${title ? `<dc:title>${buildLangAlt(title)}</dc:title>` : ""}
    ${(description || title) ? `<dc:description>${buildLangAlt(description || title)}</dc:description>` : ""}
    ${keywordsBag ? `<dc:subject>${keywordsBag}</dc:subject>` : ""}
    
    <!-- Photoshop fields (matches JPEG XMP) -->
    ${title ? `<photoshop:Headline>${escapeXml(title)}</photoshop:Headline>` : ""}
    ${(description || title) ? `<photoshop:Caption>${escapeXml(description || title)}</photoshop:Caption>` : ""}
    ${category ? `<photoshop:Category>${escapeXml(category)}</photoshop:Category>` : ""}
    
    <!-- XMP fields (matches JPEG XMP) -->
    ${title ? `<xmp:Label>${escapeXml(title)}</xmp:Label>` : ""}
    ${title ? `<xmp:Title>${escapeXml(title)}</xmp:Title>` : ""}
    ${(description || title) ? `<xmp:Description>${escapeXml(description || title)}</xmp:Description>` : ""}
    
    <!-- IPTC Extension fields (matches JPEG XMP) -->
    ${altText ? `<Iptc4xmpExt:AltTextAccessibility>${buildLangAlt(altText)}</Iptc4xmpExt:AltTextAccessibility>` : ""}
    
    <!-- IPTC Core fields (matches JPEG IPTC) -->
    ${title ? `<iptc:ObjectName>${escapeXml(title)}</iptc:ObjectName>` : ""}
    ${(description || title) ? `<iptc:Caption>${escapeXml(description || title)}</iptc:Caption>` : ""}
    ${keywordsBag ? `<iptc:Keywords>${keywordsBag}</iptc:Keywords>` : ""}
    
    <!-- TIFF fields (for EXIF compatibility) -->
    ${(description || title) ? `<tiff:ImageDescription>${escapeXml(description || title)}</tiff:ImageDescription>` : ""}
    
    <!-- EXIF fields (for EXIF compatibility) -->
    ${(description || title) ? `<exif:UserComment>${escapeXml(description || title)}</exif:UserComment>` : ""}
    
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Create a comprehensive set of text chunks that mirror JPEG metadata fields
 */
function createComprehensiveTextChunks(metadata: EmbedMetadataInput): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  
  const title = metadata.title?.trim();
  const description = metadata.description?.trim();
  const altText = metadata.altText?.trim() || description || title;
  const category = metadata.category?.trim();
  
  const keywords = metadata.keywords
    ? metadata.keywords.split(/,\s*/).filter((k) => k.trim())
    : [];
  
  const keywordsString = keywords.join(", ");

  // Title fields (matches JPEG Title, Object Name, Headline, XP Title)
  if (title) {
    chunks.push(createITXtChunk("Title", title));
    chunks.push(createTExtChunk("Title", title));
    chunks.push(createITXtChunk("Headline", title));
    chunks.push(createTExtChunk("Headline", title));
    chunks.push(createITXtChunk("Object Name", title));
    chunks.push(createTExtChunk("Object Name", title));
    chunks.push(createITXtChunk("XP Title", title));
    chunks.push(createTExtChunk("XP Title", title));
  }
  
  // Description fields (matches JPEG Description, Caption, Image Description, XP Comment)
  if (description || title) {
    const descText = description || title || "";
    chunks.push(createITXtChunk("Description", descText));
    chunks.push(createTExtChunk("Description", descText));
    chunks.push(createITXtChunk("Caption", descText));
    chunks.push(createTExtChunk("Caption", descText));
    chunks.push(createITXtChunk("Caption-Abstract", descText));
    chunks.push(createTExtChunk("Caption-Abstract", descText));
    chunks.push(createITXtChunk("Image Description", descText));
    chunks.push(createTExtChunk("Image Description", descText));
    chunks.push(createITXtChunk("XP Comment", descText));
    chunks.push(createTExtChunk("XP Comment", descText));
  }
  
  // Keywords fields (matches JPEG Keywords, Subject, XP Keywords)
  if (keywords.length > 0) {
    chunks.push(createITXtChunk("Keywords", keywordsString));
    chunks.push(createTExtChunk("Keywords", keywordsString));
    chunks.push(createITXtChunk("Subject", keywordsString));
    chunks.push(createTExtChunk("Subject", keywordsString));
    chunks.push(createITXtChunk("XP Keywords", keywordsString));
    chunks.push(createTExtChunk("XP Keywords", keywordsString));
    chunks.push(createITXtChunk("Comment", keywordsString));
    chunks.push(createTExtChunk("Comment", keywordsString));
  }
  
  // Category field
  if (category) {
    chunks.push(createITXtChunk("Category", category));
    chunks.push(createTExtChunk("Category", category));
  }
  
  // Label field (matches JPEG Label)
  if (title) {
    chunks.push(createITXtChunk("Label", title));
    chunks.push(createTExtChunk("Label", title));
  }
  
  // Alt Text field (matches JPEG Alt Text Accessibility)
  if (altText) {
    chunks.push(createITXtChunk("Alt Text", altText));
    chunks.push(createTExtChunk("Alt Text", altText));
    chunks.push(createITXtChunk("Alt Text Accessibility", altText));
    chunks.push(createTExtChunk("Alt Text Accessibility", altText));
  }
  
  return chunks;
}

/**
 * Remove all existing metadata chunks to avoid duplicates
 */
function stripExistingMetadataChunks(data: Uint8Array): Uint8Array {
  const keptChunks: Uint8Array[] = [];
  let pos = 0;
  
  while (pos + 8 <= data.length) {
    const len = ((data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]) >>> 0;
    const type = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    const chunkTotal = 4 + 4 + len + 4;
    
    if (pos + chunkTotal > data.length) break;

    // Check if this is an XMP chunk (iTXt with "XML:com.adobe.xmp" keyword)
    let isXMPChunk = false;
    if (type === "iTXt") {
      // Look for "XML:com.adobe.xmp" at the start of the data
      const xmpSig = "XML:com.adobe.xmp";
      let match = true;
      for (let i = 0; i < xmpSig.length; i++) {
        if (data[pos + 8 + i] !== xmpSig.charCodeAt(i)) {
          match = false;
          break;
        }
      }
      isXMPChunk = match;
    }

    // Remove all text chunks and XMP chunks
    const isTextChunk = type === "tEXt" || type === "iTXt" || type === "zTXt";
    
    if (!isTextChunk && !isXMPChunk) {
      keptChunks.push(data.slice(pos, pos + chunkTotal));
    }
    
    pos += chunkTotal;
  }

  // Append any remaining data
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
 * Embed comprehensive metadata into PNG
 * This will produce the same metadata fields as the JPEG version
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
  const altText = metadata.altText?.trim() || description || title;
  const category = metadata.category?.trim();
  
  const keywords = metadata.keywords
    ? metadata.keywords.split(/,\s*/).filter((k) => k.trim())
    : [];

  // Build comprehensive metadata chunks
  const chunks: Uint8Array[] = [];

  // 1. Add comprehensive XMP packet (this will contain ALL fields like JPEG)
  const xmpPacket = buildComprehensiveXmpPacket({
    title,
    description,
    altText,
    keywords: keywords.join(", "),
    category
  });
  
  if (xmpPacket) {
    chunks.push(createITXtChunk("XML:com.adobe.xmp", xmpPacket));
  }

  // 2. Add comprehensive text chunks for maximum compatibility
  // This ensures even basic PNG readers can see the metadata
  const textChunks = createComprehensiveTextChunks({
    title,
    description,
    altText,
    keywords: keywords.join(", "),
    category
  });
  
  chunks.push(...textChunks);

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

  // Remove existing metadata chunks from the 'afterIHDR' portion
  const cleanedAfter = stripExistingMetadataChunks(afterIHDR);

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
  
  // 4. Rest of PNG chunks (with existing metadata chunks removed)
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
