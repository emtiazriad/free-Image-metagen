import type { MetaGenControls } from "./types";

/**
 * MAIN PROMPT — Multi-platform optimized
 */
export function buildPrompt(controls: MetaGenControls) {
  const {
    titleLengthMin,
    titleLengthMax,
    descLengthMin,
    descLengthMax,
    keywordCount,
    keywordStyle,
    tone,
    positiveKeywords
  } = controls;

  const positiveKeywordsSection = positiveKeywords?.trim()
    ? `POSITIVE KEYWORDS TO INCLUDE:
You MUST naturally incorporate these concepts where appropriate: ${positiveKeywords.trim()}`
    : "";

  return `You are a professional stock photography SEO specialist generating metadata optimized for Adobe Stock, Shutterstock, Freepik, and similar marketplaces.

Analyze the image carefully and generate high-performing, platform-compliant metadata under STRICT constraints.

PLATFORM SEO CONTEXT:
• Adobe Stock prioritizes: Title + first 7 keywords
• Shutterstock prioritizes: first 10 keywords + description relevance
• Freepik prioritizes: Title, Description, Tags relevance
• Keyword ORDER directly affects ranking

CONTEXT:
• Keyword style: ${keywordStyle}
• Tone: ${tone}
${positiveKeywordsSection}

OUTPUT FORMAT (EXACT — no extra text):
TITLE:
DESCRIPTION:
ALT_TEXT:
KEYWORDS:
HASHTAGS:
CATEGORIES:

═══════════════════════════════════════════════════════════════
MANDATORY LENGTH & STRUCTURE RULES — FAILURE = REJECTION
═══════════════════════════════════════════════════════════════

TITLE REQUIREMENTS:
• MINIMUM: ${titleLengthMin} characters
• MAXIMUM: ${titleLengthMax} characters
• Count ALL characters including spaces and punctuation
• Start with the PRIMARY subject
• Include style, key visual traits, mood, and intended use
• Natural language only (no keyword lists)
• Optimized for Adobe Stock & Freepik

DESCRIPTION REQUIREMENTS:
• MINIMUM: ${descLengthMin} characters
• MAXIMUM: ${descLengthMax} characters
• Single paragraph, 2–4 flowing sentences
• Describe colors, textures, lighting, composition, and atmosphere
• Naturally mention professional use cases (web, print, UI, branding, marketing)
• Avoid keyword stuffing or repetition
• Optimized for Shutterstock & Freepik

ALT_TEXT REQUIREMENTS:
• Single sentence
• 50–150 characters
• Literal visual description for accessibility
• No hashtags, no keyword lists

KEYWORDS REQUIREMENTS (CRITICAL):
• EXACTLY ${keywordCount} keywords — not more, not less
• Comma-separated
• Lowercase
• Single words or 2–3 word phrases only
• No duplicates or near-duplicates
• ORDER MATTERS:
  – First 7–10 keywords = highest SEO priority
  – Remaining keywords = supporting concepts
• Include subject, style, mood, colors, concepts, and use cases
• Optimized for Adobe Stock & Shutterstock

HASHTAGS REQUIREMENTS:
• 10–15 hashtags
• Single-word only
• Lowercase
• No punctuation or multi-word phrases
• Relevant but not repetitive

CATEGORIES REQUIREMENTS:
• 2–5 broad stock marketplace categories
• Comma-separated
• Examples: Backgrounds, Abstract, Technology, Business, Nature

═══════════════════════════════════════════════════════════════
GLOBAL RULES
═══════════════════════════════════════════════════════════════
• Every field must be present and NON-EMPTY
• Each field must be ONE paragraph only (no line breaks inside fields)
• Do NOT repeat the same phrase excessively across fields
• Do NOT use placeholders, explanations, or markdown
• Return ONLY the required fields in the exact format above

FINAL CHECK (MANDATORY):
Before responding, verify:
• TITLE length is within limits
• DESCRIPTION length is within limits
• KEYWORDS count is EXACT
If any condition fails, FIX IT BEFORE OUTPUT.`;
}

/**
 * CONSTRAINT REPAIR PROMPT — Targeted Fixes Only
 */
export function buildConstraintRepairPrompt(
  controls: MetaGenControls,
  issues: {
    titleTooShort?: boolean;
    titleTooLong?: boolean;
    descTooShort?: boolean;
    descTooLong?: boolean;
    keywordsTooFew?: boolean;
    keywordsTooMany?: boolean;
  },
  currentOutput: {
    title?: string;
    description?: string;
    keywords?: string;
  }
) {
  const {
    titleLengthMin,
    titleLengthMax,
    descLengthMin,
    descLengthMax,
    keywordCount
  } = controls;

  const repairs: string[] = [];

  if (issues.titleTooShort || issues.titleTooLong) {
    const len = currentOutput.title?.length ?? 0;
    repairs.push(
      `TITLE ISSUE: ${
        issues.titleTooShort
          ? `TOO SHORT (${len} chars, must be ${titleLengthMin}-${titleLengthMax}) — EXPAND with descriptive details`
          : `TOO LONG (${len} chars, must be ${titleLengthMin}-${titleLengthMax}) — SHORTEN without losing meaning`
      }`
    );
  }

  if (issues.descTooShort || issues.descTooLong) {
    const len = currentOutput.description?.length ?? 0;
    repairs.push(
      `DESCRIPTION ISSUE: ${
        issues.descTooShort
          ? `TOO SHORT (${len} chars, must be ${descLengthMin}-${descLengthMax}) — ADD visual detail and use cases`
          : `TOO LONG (${len} chars, must be ${descLengthMin}-${descLengthMax}) — TRIM while preserving SEO`
      }`
    );
  }

  if (issues.keywordsTooFew || issues.keywordsTooMany) {
    const count =
      currentOutput.keywords?.split(",").filter(k => k.trim()).length ?? 0;
    repairs.push(
      `KEYWORDS ISSUE: ${
        issues.keywordsTooFew
          ? `TOO FEW (${count}, must be exactly ${keywordCount}) — ADD relevant keywords`
          : `TOO MANY (${count}, must be exactly ${keywordCount}) — REMOVE least relevant keywords`
      }`
    );
  }

  return `CONSTRAINT REPAIR MODE — Fix ONLY the listed issues.

${repairs.join("\n")}

CURRENT VALUES:
${issues.titleTooShort || issues.titleTooLong ? `TITLE (${currentOutput.title?.length ?? 0} chars): ${currentOutput.title}` : ""}
${issues.descTooShort || issues.descTooLong ? `DESCRIPTION (${currentOutput.description?.length ?? 0} chars): ${currentOutput.description}` : ""}
${issues.keywordsTooFew || issues.keywordsTooMany ? `KEYWORDS (${currentOutput.keywords?.split(",").filter(k => k.trim()).length ?? 0}): ${currentOutput.keywords}` : ""}

OUTPUT FORMAT — Return ONLY the fields that require fixing:
${issues.titleTooShort || issues.titleTooLong ? `TITLE:` : ""}
${issues.descTooShort || issues.descTooLong ? `DESCRIPTION:` : ""}
${issues.keywordsTooFew || issues.keywordsTooMany ? `KEYWORDS:` : ""}

CRITICAL:
• Recount characters and keywords carefully
• Maintain SEO priority order in keywords
• Do NOT modify fields that are already valid`;
}
