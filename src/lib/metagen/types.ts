export type ProviderId = "gemini" | "groq";

export type KeywordStyle = "SEO Focused" | "Stock Photography" | "Social Media" | "Artistic";
export type Tone = "Professional" | "Creative" | "Marketing" | "Technical";

export type MetaGenControls = {
  titleLengthMin: number;
  titleLengthMax: number;
  descLengthMin: number;
  descLengthMax: number;
  keywordCount: number;
  keywordStyle: KeywordStyle;
  tone: Tone;
  positiveKeywords?: string;
};

export type MetaGenOutput = {
  title: string;
  description: string;
  altText: string;
  keywords: string;
  hashtags: string;
  categories: string;
};

export const emptyOutput: MetaGenOutput = {
  title: "",
  description: "",
  altText: "",
  keywords: "",
  hashtags: "",
  categories: "",
};

// Re-export embed types for convenience
export type { EmbedSettings, EmbedPreset } from "./embedMetadata";
export { defaultEmbedSettings, embedPresets } from "./embedMetadata";
