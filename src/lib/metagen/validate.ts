import type { MetaGenControls, MetaGenOutput } from "./types";

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

export type ConstraintIssues = {
  titleTooShort?: boolean;
  titleTooLong?: boolean;
  descTooShort?: boolean;
  descTooLong?: boolean;
  keywordsTooFew?: boolean;
  keywordsTooMany?: boolean;
};

export function checkConstraints(o: MetaGenOutput, controls: MetaGenControls): ConstraintIssues {
  const issues: ConstraintIssues = {};
  
  const titleLen = o.title?.length ?? 0;
  if (titleLen > 0 && titleLen < controls.titleLengthMin) issues.titleTooShort = true;
  if (titleLen > controls.titleLengthMax) issues.titleTooLong = true;
  
  const descLen = o.description?.length ?? 0;
  if (descLen > 0 && descLen < controls.descLengthMin) issues.descTooShort = true;
  if (descLen > controls.descLengthMax) issues.descTooLong = true;
  
  const keywordCount = o.keywords?.split(',').filter(k => k.trim()).length ?? 0;
  if (keywordCount > 0 && keywordCount < controls.keywordCount) issues.keywordsTooFew = true;
  if (keywordCount > controls.keywordCount) issues.keywordsTooMany = true;
  
  return issues;
}

export function hasConstraintIssues(issues: ConstraintIssues): boolean {
  return Object.values(issues).some(v => v === true);
}
