import type { MetaGenControls } from "./types";

export function buildPrompt(controls: MetaGenControls) {
  const { titleLengthMin, titleLengthMax, descLengthMin, descLengthMax, keywordCount, keywordStyle, tone } = controls;

  return `You are an expert in image SEO, stock photography metadata, and digital asset optimization.
Analyze this image and generate metadata according to STRICT character limits.

CONTEXT:
- Keyword style: ${keywordStyle}
- Tone: ${tone}

OUTPUT FORMAT:
TITLE:
DESCRIPTION:
ALT_TEXT:
KEYWORDS:
HASHTAGS:
CATEGORIES:

CRITICAL LENGTH REQUIREMENTS (MUST FOLLOW EXACTLY):
• TITLE: MINIMUM ${titleLengthMin} characters, MAXIMUM ${titleLengthMax} characters. Count every character including spaces. The title MUST have at least ${titleLengthMin} characters - shorter titles are REJECTED.
• DESCRIPTION: MINIMUM ${descLengthMin} characters, MAXIMUM ${descLengthMax} characters. Count every character including spaces. The description MUST have at least ${descLengthMin} characters - shorter descriptions are REJECTED.

OTHER RULES:
• Generate EXACTLY ${keywordCount} keywords, comma-separated.
• Keywords must be unique and SEO/stock-friendly.
• Avoid keyword stuffing.
• Descriptions must sound natural and human-like.
• Focus on objects, scene, lighting, mood, colors, and use case.
• Optimize metadata for search engines and stock marketplaces.
• Every field MUST be present and NON-EMPTY (especially ALT_TEXT, KEYWORDS, CATEGORIES).
• ALT_TEXT should be a single sentence describing the image for accessibility.
• CATEGORIES should be a short comma-separated list (e.g., "Nature, Travel").
• Do NOT use placeholders like "N/A".
• Do NOT add extra commentary or explanations.
• Return ONLY the fields in the exact format above (one label per line).`;
}
