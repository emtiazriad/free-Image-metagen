import type { MetaGenOutput } from "./types";

export type MissingField = "altText" | "keywords" | "categories";

const isBlank = (v: string | null | undefined) => !v || !v.trim();

export function getMissingRequiredFields(o: MetaGenOutput): MissingField[] {
  const missing: MissingField[] = [];
  if (isBlank(o.altText)) missing.push("altText");
  if (isBlank(o.keywords)) missing.push("keywords");
  if (isBlank(o.categories)) missing.push("categories");
  return missing;
}

export function hasAllRequiredFields(o: MetaGenOutput): boolean {
  return getMissingRequiredFields(o).length === 0;
}
