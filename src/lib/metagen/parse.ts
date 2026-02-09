import type { MetaGenOutput, MetaGenControls } from "./types";
import { emptyOutput } from "./types";

const labels = [
  "TITLE",
  "DESCRIPTION",
  // Backwards-compat for older prompts/outputs
  "SHORT_DESCRIPTION",
  "LONG_DESCRIPTION",
  "ALT_TEXT",
  "KEYWORDS",
  "KEYWORD",
  "HASHTAGS",
  "CATEGORIES",
  "CATEGORY",
] as const;

type Label = (typeof labels)[number];

function normalizeLabel(s: string): Label | null {
  const upper = s
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  return (labels as readonly string[]).includes(upper) ? (upper as Label) : null;
}

/** Convert text to sentence case: only first letter capitalized */
function toSentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function parseMetadataText(text: string): MetaGenOutput {
  const out: MetaGenOutput = { ...emptyOutput };
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let current: Label | null = null;
  const bucket: Record<Label, string[]> = {
    TITLE: [],
    DESCRIPTION: [],
    SHORT_DESCRIPTION: [],
    LONG_DESCRIPTION: [],
    ALT_TEXT: [],
    KEYWORDS: [],
    KEYWORD: [],
    HASHTAGS: [],
    CATEGORIES: [],
    CATEGORY: [],
  };

  for (const raw of lines) {
    const m = raw.match(/^([A-Za-z_ ]+):\s*(.*)$/);
    if (m) {
      const lbl = normalizeLabel(m[1]);
      if (lbl) {
        current = lbl;
        if (m[2]) bucket[lbl].push(m[2]);
        continue;
      }
    }
    if (current) bucket[current].push(raw);
  }

  const join = (lbl: Label) => bucket[lbl].join("\n").trim();
  
  // Apply sentence case to title (only first letter capitalized)
  out.title = toSentenceCase(join("TITLE"));
  
  // Prefer new field; fall back to legacy if model returned old labels.
  out.description = join("DESCRIPTION") || join("LONG_DESCRIPTION") || join("SHORT_DESCRIPTION");
  out.altText = join("ALT_TEXT");

  out.keywords = join("KEYWORDS") || join("KEYWORD");
  out.hashtags = join("HASHTAGS");
  out.categories = join("CATEGORIES") || join("CATEGORY");
  return out;
}

/**
 * Enforce length constraints on title and description by truncating if too long.
 * For text that's too short, we cannot magically add content - we keep what we have
 * and let the AI repair loop handle it. But we CAN ensure max limits are respected.
 */
export function enforceConstraints(output: MetaGenOutput, controls: MetaGenControls): MetaGenOutput {
  let { title, description, keywords } = output;
  
  // Truncate title if too long (preserve word boundaries when possible)
  if (title && title.length > controls.titleLengthMax) {
    title = smartTruncate(title, controls.titleLengthMax);
    // Re-apply sentence case after truncation
    title = toSentenceCase(title);
  }
  
  // Truncate description if too long
  if (description && description.length > controls.descLengthMax) {
    description = smartTruncate(description, controls.descLengthMax);
  }
  
  // Normalize keyword count
  if (keywords) {
    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
    if (keywordList.length > controls.keywordCount) {
      // Too many - take first N
      keywords = keywordList.slice(0, controls.keywordCount).join(', ');
    }
    // Note: if too few keywords, we can't generate more here - AI repair handles it
  }
  
  return {
    ...output,
    title,
    description,
    keywords,
  };
}

/**
 * Truncate text to maxLen, trying to preserve sentence boundaries.
 * Prefers ending at a complete sentence (period, exclamation, question mark).
 * Falls back to word boundaries if no sentence break is found.
 */
function smartTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  
  const truncated = text.slice(0, maxLen);
  
  // First, try to find the last sentence boundary (. ! ?)
  const sentenceEnders = ['. ', '! ', '? ', '.', '!', '?'];
  let bestCut = -1;
  
  for (const ender of sentenceEnders) {
    const idx = truncated.lastIndexOf(ender);
    if (idx > maxLen * 0.5 && idx > bestCut) {
      // Include the punctuation mark but not trailing space
      bestCut = idx + 1;
    }
  }
  
  if (bestCut > 0) {
    return truncated.slice(0, bestCut).trim();
  }
  
    // No sentence boundary found - fall back to word boundary and add period
  const lastSpace = truncated.lastIndexOf(' ');
  
  let result: string;
  if (lastSpace > maxLen * 0.7) {
    result = truncated.slice(0, lastSpace);
  } else {
    result = truncated;
  }
  
 // Clean up trailing punctuation/spaces and ensure sentence ends properly
  result = result.replace(/[\s,\-:;]+$/, '').trim();
  
  // Add a period if the result doesn't end with sentence-ending punctuation
  if (result && !/[.!?]$/.test(result)) {
    result += '.';
  }
  
  return result;
}
