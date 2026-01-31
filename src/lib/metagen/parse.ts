import type { MetaGenOutput } from "./types";
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
  out.title = join("TITLE");
  // Prefer new field; fall back to legacy if model returned old labels.
  out.description = join("DESCRIPTION") || join("LONG_DESCRIPTION") || join("SHORT_DESCRIPTION");
  out.altText = join("ALT_TEXT");

  out.keywords = join("KEYWORDS") || join("KEYWORD");
  out.hashtags = join("HASHTAGS");
  out.categories = join("CATEGORIES") || join("CATEGORY");
  return out;
}
