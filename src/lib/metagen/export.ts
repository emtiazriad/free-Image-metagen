import type { MetaGenOutput } from "./types";

export function toPlainText(o: MetaGenOutput) {
  return [
    `TITLE: ${o.title}`,
    `DESCRIPTION: ${o.description}`,
    `ALT_TEXT: ${o.altText}`,
    `KEYWORDS: ${o.keywords}`,
    `HASHTAGS: ${o.hashtags}`,
    `CATEGORIES: ${o.categories}`,
  ].join("\n");
}

export function toCSV(o: MetaGenOutput) {
  const rows: Array<[string, string]> = [
    ["TITLE", o.title],
    ["DESCRIPTION", o.description],
    ["ALT_TEXT", o.altText],
    ["KEYWORDS", o.keywords],
    ["HASHTAGS", o.hashtags],
    ["CATEGORIES", o.categories],
  ];
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  return rows.map(([k, v]) => `${esc(k)},${esc(v)}`).join("\n");
}

export function toAdobeStock(o: MetaGenOutput) {
  // Simple “stock-ready” layout; user can paste into contributor portals.
  return [
    "ADOBE_STOCK",
    `Title: ${o.title}`,
    `Keywords: ${o.keywords}`,
    `Category: ${o.categories}`,
  ].join("\n");
}

export function toAdobeStockCSV(o: MetaGenOutput) {
  // Simple single-row CSV template for spreadsheets / contributor workflows.
  // Columns can be adjusted later if you want a specific Adobe Stock schema.
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const headers = ["Title", "Keywords", "Category"].map(esc).join(",");
  const row = [o.title, o.keywords, o.categories].map(esc).join(",");
  return `${headers}\n${row}`;
}

export function toShutterstock(o: MetaGenOutput) {
  return [
    "SHUTTERSTOCK",
    `Description: ${o.description}`,
    `Keywords: ${o.keywords}`,
    `Categories: ${o.categories}`,
  ].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
