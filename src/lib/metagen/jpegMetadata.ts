/**
 * Client-side JPEG metadata embedding
 * Ports the edge function logic to run entirely in the browser
 * Supports IPTC, EXIF, and XMP metadata standards
 */

// IPTC-IIM record 2 tag IDs
const IPTC_TAGS = {
  OBJECT_NAME: 5,      // Object Name (2:05)
  CATEGORY: 15,        // Category (2:15)
  KEYWORDS: 25,        // Keywords (2:25)
  HEADLINE: 105,       // Headline / Title in many apps (2:105)
  CAPTION_ABSTRACT: 120, // Caption/Description (2:120)
};

// EXIF tag IDs
const EXIF_TAGS = {
  IMAGE_DESCRIPTION: 0x010e,
  XP_TITLE: 0x9c9b,
  XP_COMMENT: 0x9c9c,
  XP_KEYWORDS: 0x9c9e,
  XP_SUBJECT: 0x9c9f,
};

// Create IPTC dataset (record 2)
function createIPTCDataset(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const len = valueBytes.length;

  // IPTC marker (0x1c), record (0x02), tag, size (2 bytes), value
  const dataset = new Uint8Array(5 + len);
  dataset[0] = 0x1c; // IPTC marker
  dataset[1] = 0x02; // Record 2
  dataset[2] = tag;
  dataset[3] = (len >> 8) & 0xff;
  dataset[4] = len & 0xff;
  dataset.set(valueBytes, 5);

  return dataset;
}

// Create full IPTC-IIM block
function createIPTCBlock(metadata: {
  title?: string;
  description?: string;
  keywords?: string[];
  category?: string;
}): Uint8Array {
  const datasets: Uint8Array[] = [];

  // Add Object Name (Title)
  if (metadata.title) {
    // NOTE: IPTC Object Name is limited to 64 chars by spec.
    datasets.push(createIPTCDataset(IPTC_TAGS.OBJECT_NAME, metadata.title.slice(0, 64)));
  }

  // Add Headline (Title field in many IPTC viewers)
  if (metadata.title) {
    datasets.push(createIPTCDataset(IPTC_TAGS.HEADLINE, metadata.title.slice(0, 256)));
  }

  // Add Caption-Abstract (Description)
  if (metadata.description) {
    datasets.push(createIPTCDataset(IPTC_TAGS.CAPTION_ABSTRACT, metadata.description.slice(0, 2000)));
  }

  // Add Category
  if (metadata.category) {
    datasets.push(createIPTCDataset(IPTC_TAGS.CATEGORY, metadata.category.slice(0, 3)));
  }

  // Add Keywords (each keyword as separate dataset)
  if (metadata.keywords && metadata.keywords.length > 0) {
    for (const keyword of metadata.keywords) {
      if (keyword.trim()) {
        datasets.push(createIPTCDataset(IPTC_TAGS.KEYWORDS, keyword.trim().slice(0, 64)));
      }
    }
  }

  // Combine all datasets
  const totalLength = datasets.reduce((sum, d) => sum + d.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const dataset of datasets) {
    combined.set(dataset, offset);
    offset += dataset.length;
  }

  return combined;
}

// Create Photoshop 3.0 resource block containing IPTC data
function createPhotoshopIPTCResource(iptcData: Uint8Array): Uint8Array {
  // Photoshop resource header: "8BIM" + resource ID (0x0404 for IPTC) + pascal string + size + data
  const signature = new TextEncoder().encode("8BIM");
  const resourceId = 0x0404; // IPTC-NAA record
  const pascalName = new Uint8Array([0]); // Empty pascal string (just null byte)

  // Pad IPTC data to even length
  const paddedLength = iptcData.length + (iptcData.length % 2);
  const paddedData = new Uint8Array(paddedLength);
  paddedData.set(iptcData);

  // Total: 4 (8BIM) + 2 (resource ID) + 1 (pascal string) + 1 (padding) + 4 (size) + data
  const block = new Uint8Array(12 + paddedLength);
  block.set(signature, 0);
  block[4] = (resourceId >> 8) & 0xff;
  block[5] = resourceId & 0xff;
  block.set(pascalName, 6);
  block[7] = 0; // Padding to make pascal string even
  block[8] = (iptcData.length >> 24) & 0xff;
  block[9] = (iptcData.length >> 16) & 0xff;
  block[10] = (iptcData.length >> 8) & 0xff;
  block[11] = iptcData.length & 0xff;
  block.set(paddedData, 12);

  return block;
}

// Encode string to UTF-16LE for XP tags
function encodeUTF16LE(str: string): Uint8Array {
  const result = new Uint8Array(str.length * 2 + 2); // +2 for null terminator
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    result[i * 2] = code & 0xff;
    result[i * 2 + 1] = (code >> 8) & 0xff;
  }
  // Null terminator
  result[str.length * 2] = 0;
  result[str.length * 2 + 1] = 0;
  return result;
}

// Create EXIF IFD entry
function createIFDEntry(tag: number, type: number, count: number, valueOffset: number): Uint8Array {
  const entry = new Uint8Array(12);
  // Tag (2 bytes, little-endian)
  entry[0] = tag & 0xff;
  entry[1] = (tag >> 8) & 0xff;
  // Type (2 bytes, little-endian)
  entry[2] = type & 0xff;
  entry[3] = (type >> 8) & 0xff;
  // Count (4 bytes, little-endian)
  entry[4] = count & 0xff;
  entry[5] = (count >> 8) & 0xff;
  entry[6] = (count >> 16) & 0xff;
  entry[7] = (count >> 24) & 0xff;
  // Value/Offset (4 bytes, little-endian)
  entry[8] = valueOffset & 0xff;
  entry[9] = (valueOffset >> 8) & 0xff;
  entry[10] = (valueOffset >> 16) & 0xff;
  entry[11] = (valueOffset >> 24) & 0xff;
  return entry;
}

// Create EXIF APP1 segment with ImageDescription and XP tags
function createEXIFSegment(metadata: { title?: string; description?: string; keywords?: string[] }): Uint8Array {
  if (!metadata.title && !metadata.description && (!metadata.keywords || metadata.keywords.length === 0)) {
    return new Uint8Array(0);
  }

  const entries: { tag: number; type: number; data: Uint8Array }[] = [];

  // ImageDescription (ASCII string, type 2) - use description
  if (metadata.description || metadata.title) {
    const encoder = new TextEncoder();
    const descBytes = encoder.encode((metadata.description || metadata.title) + "\0");
    entries.push({ tag: EXIF_TAGS.IMAGE_DESCRIPTION, type: 2, data: descBytes });
  }

  // XPTitle (BYTE array interpreted as UTF-16LE, type 1)
  if (metadata.title) {
    const xpTitleBytes = encodeUTF16LE(metadata.title);
    entries.push({ tag: EXIF_TAGS.XP_TITLE, type: 1, data: xpTitleBytes });
  }

  // XPComment (BYTE array interpreted as UTF-16LE, type 1) - use description
  if (metadata.description || metadata.title) {
    const xpCommentBytes = encodeUTF16LE(metadata.description || metadata.title || "");
    entries.push({ tag: EXIF_TAGS.XP_COMMENT, type: 1, data: xpCommentBytes });
  }

  // XPKeywords (BYTE array interpreted as UTF-16LE, type 1)
  if (metadata.keywords && metadata.keywords.length > 0) {
    const keywordsStr = metadata.keywords.join("; ");
    const xpKeywordsBytes = encodeUTF16LE(keywordsStr);
    entries.push({ tag: EXIF_TAGS.XP_KEYWORDS, type: 1, data: xpKeywordsBytes });
  }

  // XPSubject (BYTE array interpreted as UTF-16LE, type 1) - used by some viewers for "Subject"
  if (metadata.title) {
    const xpSubjectBytes = encodeUTF16LE(metadata.title);
    entries.push({ tag: EXIF_TAGS.XP_SUBJECT, type: 1, data: xpSubjectBytes });
  }

  // Sort entries by tag number (required by EXIF spec)
  entries.sort((a, b) => a.tag - b.tag);

  // Calculate sizes
  const numEntries = entries.length;
  const ifdSize = 2 + numEntries * 12 + 4; // count + entries + next IFD pointer

  // TIFF header is at offset 0, IFD0 starts at offset 8
  const tiffHeaderSize = 8;
  const dataStartOffset = tiffHeaderSize + ifdSize;

  // Build data section and calculate offsets
  let currentDataOffset = dataStartOffset;
  const entryData: { entry: Uint8Array; data: Uint8Array | null }[] = [];

  for (const e of entries) {
    if (e.data.length <= 4) {
      // Value fits in offset field
      const paddedValue = new Uint8Array(4);
      paddedValue.set(e.data);
      entryData.push({
        entry: createIFDEntry(
          e.tag,
          e.type,
          e.data.length,
          paddedValue[0] |
            (paddedValue[1] << 8) |
            (paddedValue[2] << 16) |
            (paddedValue[3] << 24),
        ),
        data: null,
      });
    } else {
      // Value stored in data section
      entryData.push({
        entry: createIFDEntry(e.tag, e.type, e.data.length, currentDataOffset),
        data: e.data,
      });
      currentDataOffset += e.data.length;
      // Pad to even boundary
      if (e.data.length % 2 !== 0) {
        currentDataOffset += 1;
      }
    }
  }

  // Calculate total TIFF size
  let tiffSize = tiffHeaderSize + ifdSize;
  for (const ed of entryData) {
    if (ed.data) {
      tiffSize += ed.data.length;
      if (ed.data.length % 2 !== 0) tiffSize += 1;
    }
  }

  // Build TIFF data
  const tiffData = new Uint8Array(tiffSize);
  let offset = 0;

  // TIFF header (little-endian)
  tiffData[offset++] = 0x49; // 'I'
  tiffData[offset++] = 0x49; // 'I' (little-endian)
  tiffData[offset++] = 0x2a; // TIFF magic
  tiffData[offset++] = 0x00;
  tiffData[offset++] = 0x08; // IFD0 offset (8)
  tiffData[offset++] = 0x00;
  tiffData[offset++] = 0x00;
  tiffData[offset++] = 0x00;

  // IFD0: number of entries
  tiffData[offset++] = numEntries & 0xff;
  tiffData[offset++] = (numEntries >> 8) & 0xff;

  // IFD entries
  for (const ed of entryData) {
    tiffData.set(ed.entry, offset);
    offset += 12;
  }

  // Next IFD offset (0 = no more IFDs)
  tiffData[offset++] = 0x00;
  tiffData[offset++] = 0x00;
  tiffData[offset++] = 0x00;
  tiffData[offset++] = 0x00;

  // Data section
  for (const ed of entryData) {
    if (ed.data) {
      tiffData.set(ed.data, offset);
      offset += ed.data.length;
      if (ed.data.length % 2 !== 0) {
        tiffData[offset++] = 0x00; // Padding
      }
    }
  }

  // Build APP1 segment
  const exifIdent = new TextEncoder().encode("Exif\0\0");
  const segmentLength = 2 + exifIdent.length + tiffData.length;

  const app1Segment = new Uint8Array(2 + segmentLength);
  app1Segment[0] = 0xff;
  app1Segment[1] = 0xe1; // APP1 marker
  app1Segment[2] = (segmentLength >> 8) & 0xff;
  app1Segment[3] = segmentLength & 0xff;
  app1Segment.set(exifIdent, 4);
  app1Segment.set(tiffData, 4 + exifIdent.length);

  return app1Segment;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildLangAlt(value: string): string {
  return `<rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt>`;
}

// Create XMP APP1 segment (for apps that read Title/Description from XMP instead of IPTC-IIM)
function createXMPSegment(metadata: {
  title?: string;
  description?: string;
  keywords?: string[];
  altText?: string;
  label?: string;
}): Uint8Array {
  const title = metadata.title?.trim();
  const keywords = (metadata.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const description = metadata.description?.trim();
  const label = metadata.label?.trim();
  const altText = metadata.altText?.trim();

  if (!title && !description && keywords.length === 0 && !altText && !label) {
    return new Uint8Array(0);
  }

  const effectiveDescription = title || description || "";
  const effectiveLabel = label || title || "";
  const effectiveAltText = altText || title || "";

  const dcTitle = title ? `<dc:title>${buildLangAlt(title)}</dc:title>` : "";
  const dcDesc = effectiveDescription
    ? `<dc:description>${buildLangAlt(effectiveDescription)}</dc:description>`
    : "";

  const dcSubject = keywords.length
    ? `<dc:subject><rdf:Bag>${keywords
        .map((k) => `<rdf:li>${escapeXml(k)}</rdf:li>`)
        .join("")}</rdf:Bag></dc:subject>`
    : "";

  const psHeadline = title ? `<photoshop:Headline>${escapeXml(title)}</photoshop:Headline>` : "";
  const xmpLabel = effectiveLabel ? `<xmp:Label>${escapeXml(effectiveLabel)}</xmp:Label>` : "";
  const accessibilityAlt = effectiveAltText
    ? `<Iptc4xmpExt:AltTextAccessibility>${buildLangAlt(effectiveAltText)}</Iptc4xmpExt:AltTextAccessibility>`
    : "";

  const xmpPacket = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">
    ${dcTitle}
    ${dcDesc}
    ${dcSubject}
    ${psHeadline}
    ${xmpLabel}
    ${accessibilityAlt}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const ident = new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0");
  const xmpBytes = new TextEncoder().encode(xmpPacket);

  const segmentLength = 2 + ident.length + xmpBytes.length;
  if (segmentLength > 0xffff) {
    // Avoid generating an invalid JPEG segment.
    return new Uint8Array(0);
  }

  const app1Segment = new Uint8Array(2 + segmentLength);
  app1Segment[0] = 0xff;
  app1Segment[1] = 0xe1; // APP1 marker
  app1Segment[2] = (segmentLength >> 8) & 0xff;
  app1Segment[3] = segmentLength & 0xff;
  app1Segment.set(ident, 4);
  app1Segment.set(xmpBytes, 4 + ident.length);

  return app1Segment;
}

// Find and update APP13 segment in JPEG, or insert new one
function embedMetadataInJPEG(
  jpegData: Uint8Array,
  iptcBlock: Uint8Array,
  exifSegment: Uint8Array,
  xmpSegment: Uint8Array,
): Uint8Array {
  // Create APP13 segment with Photoshop header
  const photoshopHeader = new TextEncoder().encode("Photoshop 3.0\0");
  const app13Content = new Uint8Array(photoshopHeader.length + iptcBlock.length);
  app13Content.set(photoshopHeader, 0);
  app13Content.set(iptcBlock, photoshopHeader.length);

  const segmentLength = app13Content.length + 2; // +2 for length bytes
  const app13Segment = new Uint8Array(4 + app13Content.length);
  app13Segment[0] = 0xff;
  app13Segment[1] = 0xed; // APP13 marker
  app13Segment[2] = (segmentLength >> 8) & 0xff;
  app13Segment[3] = segmentLength & 0xff;
  app13Segment.set(app13Content, 4);

  // Find position to insert and skip existing APP1/APP13
  let insertPos = 2; // After SOI (0xffd8)

  // Skip existing segments
  while (insertPos < jpegData.length - 1) {
    if (jpegData[insertPos] !== 0xff) break;

    const marker = jpegData[insertPos + 1];

    // Skip over existing APP1 segments (EXIF and/or XMP) - we'll replace with our own
    if (marker === 0xe1) {
      const len = (jpegData[insertPos + 2] << 8) | jpegData[insertPos + 3];
      insertPos += 2 + len;
      continue;
    }

    // Skip over existing APP13 segments
    if (marker === 0xed) {
      const len = (jpegData[insertPos + 2] << 8) | jpegData[insertPos + 3];
      insertPos += 2 + len;
      continue;
    }

    // Stop at non-APP markers (except APP0)
    if (marker < 0xe0 || marker > 0xef) {
      break;
    }

    // Skip APP0 (JFIF)
    if (marker === 0xe0) {
      const len = (jpegData[insertPos + 2] << 8) | jpegData[insertPos + 3];
      insertPos += 2 + len;
    } else {
      break;
    }
  }

  // Calculate new size
  let newSize = 2; // SOI

  // Add space for our new EXIF segment
  newSize += exifSegment.length;

  // Add space for our new XMP segment
  newSize += xmpSegment.length;

  // Add space for our APP13 segment
  newSize += app13Segment.length;

  // Add remaining original data (skipping old APP1/APP13 we already passed)
  newSize += jpegData.length - insertPos;

  // Build new JPEG
  const result = new Uint8Array(newSize);
  let outOffset = 0;

  // SOI marker
  result[outOffset++] = 0xff;
  result[outOffset++] = 0xd8;

  // Insert our EXIF segment (APP1)
  if (exifSegment.length > 0) {
    result.set(exifSegment, outOffset);
    outOffset += exifSegment.length;
  }

  // Insert our XMP segment (APP1)
  if (xmpSegment.length > 0) {
    result.set(xmpSegment, outOffset);
    outOffset += xmpSegment.length;
  }

  // Insert our APP13 segment
  result.set(app13Segment, outOffset);
  outOffset += app13Segment.length;

  // Copy remaining data (from after the segments we skipped)
  result.set(jpegData.slice(insertPos), outOffset);

  return result;
}

export interface EmbedMetadataInput {
  title?: string;
  description?: string;
  altText?: string;
  keywords?: string;
  category?: string;
}

/**
 * Embed IPTC/EXIF/XMP metadata into a JPEG file entirely client-side
 * Returns null if the file is not a valid JPEG
 */
export async function embedJpegMetadata(
  file: File,
  metadata: EmbedMetadataInput
): Promise<Uint8Array | null> {
  const arrayBuffer = await file.arrayBuffer();
  const jpegData = new Uint8Array(arrayBuffer);

  // Verify JPEG
  if (jpegData[0] !== 0xff || jpegData[1] !== 0xd8) {
    return null;
  }

  const title = metadata.title?.trim();
  const description = metadata.description?.trim();
  const altText = metadata.altText?.trim() || description || title;
  const category = metadata.category?.trim();
  // Use only the first word of category
  const firstWordCategory = category ? category.split(/[\s,]+/)[0] : undefined;
  
  // Parse keywords from comma-separated string
  const keywords = metadata.keywords
    ? metadata.keywords.split(/,\s*/).filter((k) => k.trim())
    : [];

  // Create IPTC data
  const iptcData = createIPTCBlock({
    title,
    description,
    keywords,
    category: firstWordCategory,
  });

  // Create Photoshop resource block
  const photoshopBlock = createPhotoshopIPTCResource(iptcData);

  // Create EXIF segment with ImageDescription and XP tags
  const exifSegment = createEXIFSegment({
    title,
    description: description || title,
    keywords,
  });

  // Create XMP segment for better cross-app compatibility
  const xmpSegment = createXMPSegment({
    title,
    description: description || title,
    label: title,
    altText,
    keywords,
  });

  // Embed into JPEG
  return embedMetadataInJPEG(jpegData, photoshopBlock, exifSegment, xmpSegment);
}

/**
 * Check if a file is a JPEG
 */
export function isJpegFile(file: File): boolean {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  return (
    file.type === "image/jpeg" ||
    ext === "jpg" ||
    ext === "jpeg"
  );
}
