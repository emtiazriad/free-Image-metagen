import type { MetaGenOutput } from "./types";

export type BatchRow = {
  filename: string;
  output: MetaGenOutput;
};

export type MarketplaceExport =
  | "generic"
  | "adobe_stock"
  | "shutterstock"
  | "freepik"
  | "pond5"
  | "istock"
  | "alamy"
  | "dreamstime"
  | "123rf";

const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

export function batchToCSV(rows: BatchRow[]) {
  const headers = [
    "filename",
    "title",
    "description",
    "alt_text",
    "keywords",
    "hashtags",
    "category",
  ].map(esc);

  const body = rows.map((r) =>
    [
      r.filename,
      r.output.title,
      r.output.description,
      r.output.altText,
      r.output.keywords,
      r.output.hashtags,
      r.output.categories,
    ]
      .map(esc)
      .join(","),
  );

  return [headers.join(","), ...body].join("\n");
}

export function batchToMarketplaceCSV(rows: BatchRow[], marketplace: MarketplaceExport) {
  if (marketplace === "generic") return batchToCSV(rows);

  const spec: Record<Exclude<MarketplaceExport, "generic">, { headers: string[]; pick: (o: MetaGenOutput, filename: string) => string[] }> = {
    adobe_stock: {
      // Adobe contributor CSV layouts vary; this is a practical, minimal template.
      headers: ["filename", "title", "keywords", "category", "alt_text"],
      pick: (o, filename) => [filename, o.title, o.keywords, o.categories, o.altText],
    },
    shutterstock: {
      // Practical bulk sheet: description + keywords are the most critical.
      headers: ["filename", "description", "keywords", "category", "title"],
      pick: (o, filename) => [filename, o.description, o.keywords, o.categories, o.title],
    },
    freepik: {
      // Freepik contributor metadata is typically title/description/tags/category.
      headers: ["filename", "title", "description", "tags", "category", "alt_text"],
      pick: (o, filename) => [filename, o.title, o.description, o.keywords, o.categories, o.altText],
    },
    pond5: {
      // Pond5 commonly uses title/description/keywords/categories.
      headers: ["filename", "title", "description", "keywords", "category", "alt_text"],
      pick: (o, filename) => [filename, o.title, o.description, o.keywords, o.categories, o.altText],
    },
    istock: {
      // iStock / Getty typically needs title, description, keywords, and category mapping.
      headers: ["filename", "title", "description", "keywords", "category", "alt_text"],
      pick: (o, filename) => [filename, o.title, o.description, o.keywords, o.categories, o.altText],
    },
    alamy: {
      // Alamy upload sheets vary; keep a simple, usable layout.
      headers: ["filename", "title", "description", "keywords", "category", "alt_text"],
      pick: (o, filename) => [filename, o.title, o.description, o.keywords, o.categories, o.altText],
    },
    dreamstime: {
      // Dreamstime commonly uses title/description/keywords/categories.
      headers: ["filename", "title", "description", "keywords", "category", "alt_text"],
      pick: (o, filename) => [filename, o.title, o.description, o.keywords, o.categories, o.altText],
    },
    "123rf": {
      // 123RF contributor metadata is similar to title/description/keywords/category.
      headers: ["filename", "title", "description", "keywords", "category", "alt_text"],
      pick: (o, filename) => [filename, o.title, o.description, o.keywords, o.categories, o.altText],
    },
  };

  const { headers, pick } = spec[marketplace];
  const headerLine = headers.map(esc).join(",");
  const body = rows.map((r) => pick(r.output, r.filename).map(esc).join(","));
  return [headerLine, ...body].join("\n");
}
