import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Pause, Play, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import type { MetaGenControls, MetaGenOutput, ProviderId } from "@/lib/metagen/types";
import { emptyOutput } from "@/lib/metagen/types";
import { buildPrompt, buildConstraintRepairPrompt } from "@/lib/metagen/prompt";
import { parseMetadataText, enforceConstraints } from "@/lib/metagen/parse";
import { downloadText, toPlainText } from "@/lib/metagen/export";
import { batchToMarketplaceCSV, type MarketplaceExport } from "@/lib/metagen/batchExport";
import { createSimpleRateLimiter } from "@/lib/metagen/rateLimit";
import { fileToBase64, generateWithProvider, testApiKeyWithProvider } from "@/lib/metagen/providers";
import { getMissingRequiredFields, hasAllRequiredFields, checkConstraints, hasConstraintIssues, type ConstraintIssues } from "@/lib/metagen/validate";
import { BatchResultsTable, type BatchItem } from "@/components/metagen/BatchResultsTable";
import { WorkspaceHeader } from "@/components/metagen/WorkspaceHeader";
import { MetaGenDetailsDrawer } from "@/components/metagen/MetaGenDetailsDrawer";
import { MetadataEditorDialog } from "@/components/metagen/MetadataEditorDialog";
import { SupportPopup } from "@/components/metagen/SupportPopup";
import { DropZone } from "@/components/metagen/DropZone";


const STORAGE_KEY = "metagen_ai_settings_v1";

type Stored = {
  provider: ProviderId;
  apiKeys: Record<ProviderId, string[]>;
  activeKeyIndex: Record<ProviderId, number>;
};

function safeParseStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        provider: "gemini",
        apiKeys: { gemini: [], groq: [] },
        activeKeyIndex: { gemini: 0, groq: 0 },
      };
    const parsed = JSON.parse(raw);
    const provider: ProviderId = parsed?.provider === "groq" ? "groq" : "gemini";

    // Backwards compat: previous versions stored a single `apiKey` string.
    const legacyApiKey = typeof parsed?.apiKey === "string" ? parsed.apiKey.trim() : "";

    const apiKeys: Record<ProviderId, string[]> = {
      gemini: Array.isArray(parsed?.apiKeys?.gemini) ? parsed.apiKeys.gemini.filter((x: any) => typeof x === "string").map((s: string) => s.trim()).filter(Boolean) : [],
      groq: Array.isArray(parsed?.apiKeys?.groq) ? parsed.apiKeys.groq.filter((x: any) => typeof x === "string").map((s: string) => s.trim()).filter(Boolean) : [],
    };
    if (legacyApiKey) {
      apiKeys[provider] = [legacyApiKey, ...apiKeys[provider]].filter(Boolean);
    }

    const activeKeyIndex: Record<ProviderId, number> = {
      gemini: Number.isFinite(parsed?.activeKeyIndex?.gemini) ? Math.max(0, Math.floor(parsed.activeKeyIndex.gemini)) : 0,
      groq: Number.isFinite(parsed?.activeKeyIndex?.groq) ? Math.max(0, Math.floor(parsed.activeKeyIndex.groq)) : 0,
    };
    return { provider, apiKeys, activeKeyIndex };
  } catch {
    return {
      provider: "gemini",
      apiKeys: { gemini: [], groq: [] },
      activeKeyIndex: { gemini: 0, groq: 0 },
    };
  }
}

function saveStored(next: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function MetaGenDashboard() {
  const { toast } = useToast();

  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string[]>>({ gemini: [], groq: [] });
  const [activeKeyIndex, setActiveKeyIndex] = useState<Record<ProviderId, number>>({ gemini: 0, groq: 0 });
  const [newKeyInput, setNewKeyInput] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);

  const [controls, setControls] = useState<MetaGenControls>({
    titleLengthMin: 100,
    titleLengthMax: 150,
    descLengthMin: 200,
    descLengthMax: 300,
    keywordCount: 30,
    keywordStyle: "SEO Focused",
    tone: "Marketing",
  });

  

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);

  const [keyTestState, setKeyTestState] = useState<
    Record<ProviderId, Record<number, { status: "idle" | "testing" | "valid" | "invalid"; code?: number; message?: string; at?: number }>>
  >({ gemini: {}, groq: {} });

  const limiter = useRef(createSimpleRateLimiter({ minIntervalMs: 6000 }));

  useEffect(() => {
    const stored = safeParseStored();
    setProvider(stored.provider);
    setApiKeys(stored.apiKeys);
    setActiveKeyIndex(stored.activeKeyIndex);
  }, []);

  useEffect(() => {
    saveStored({ provider, apiKeys, activeKeyIndex });
  }, [provider, apiKeys, activeKeyIndex]);

  useEffect(() => {
    return () => {
      // Cleanup object URLs
      for (const it of items) URL.revokeObjectURL(it.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = "Free-ImageMetagen — Image Metadata Generator";
  }, []);

  const canGenerate = useMemo(() => {
    const keys = apiKeys[provider] ?? [];
    return keys.length > 0 && items.length > 0 && !isGenerating;
  }, [apiKeys, provider, items.length, isGenerating]);

  const prompt = useMemo(() => buildPrompt(controls), [controls]);

  const makeId = () => {
    // crypto.randomUUID is supported in modern browsers; fallback for older.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto;
    return typeof c?.randomUUID === "function" ? c.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const getFileExtension = (name: string) => {
    const clean = (name ?? "").toLowerCase().trim();
    const dot = clean.lastIndexOf(".");
    return dot >= 0 ? clean.slice(dot).trim() : "";
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const okTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/svg"]);
    const okExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
    const next: BatchItem[] = [];
    for (const f of Array.from(list)) {
      const mime = (f.type ?? "").toLowerCase().trim();
      const ext = getFileExtension(f.name);
      const isOkType = okTypes.has(mime) || okExtensions.has(ext);
      if (!isOkType) {
        toast({
          title: "Unsupported file",
          description: `"${f.name}" is not a supported format (JPG, PNG, WEBP, GIF, SVG). If it's an SVG/GIF, ensure the filename ends with .svg or .gif.`,
        });
        continue;
      }
      // No hard file-size limit. Note: very large images may fail during base64 encoding
      // or exceed provider request limits.
      if (f.size > 12 * 1024 * 1024) {
        toast({
          title: "Large file selected",
          description: `"${f.name}" is large and may fail depending on provider limits, but we'll try.`,
        });
      }
      next.push({
        id: makeId(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: "queued",
      });
    }
    if (!next.length) return;
    setItems((p) => [...p, ...next]);
    setSelectedId((p) => p ?? next[0].id);
  };

  const currentKeys = apiKeys[provider] ?? [];
  const currentActiveIndex = Math.min(activeKeyIndex[provider] ?? 0, Math.max(0, currentKeys.length - 1));
  const currentActiveKey = currentKeys[currentActiveIndex] ?? "";

  const addKey = () => {
    const next = newKeyInput.trim();
    if (!next) return;

    setApiKeys((p) => {
      const existing = p[provider] ?? [];
      // de-dupe exact matches
      if (existing.includes(next)) return p;
      return { ...p, [provider]: [next, ...existing] };
    });
    setActiveKeyIndex((p) => ({ ...p, [provider]: 0 }));
    setNewKeyInput("");
    toast({ title: "API key added", description: "Saved locally in your browser." });
  };

  const testKeyAt = async (idx: number) => {
    const keys = apiKeys[provider] ?? [];
    const key = keys[idx];
    if (!key) return;

    setKeyTestState((p) => ({
      ...p,
      [provider]: {
        ...(p[provider] ?? {}),
        [idx]: { status: "testing" },
      },
    }));

    try {
      const res = await testApiKeyWithProvider({ provider, apiKey: key });
      const isInvalid = !res.ok && (res.status === 401 || res.status === 403);
      const status = res.ok ? "valid" : isInvalid ? "invalid" : "invalid";

      setKeyTestState((p) => ({
        ...p,
        [provider]: {
          ...(p[provider] ?? {}),
          [idx]: {
            status,
            code: res.status,
            message: res.detail,
            at: Date.now(),
          },
        },
      }));

      toast({
        title: res.ok ? "API key is valid" : "API key test failed",
        description: res.ok ? "Key accepted by provider." : `Provider responded with ${res.status}.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setKeyTestState((p) => ({
        ...p,
        [provider]: {
          ...(p[provider] ?? {}),
          [idx]: { status: "invalid", message: msg, at: Date.now() },
        },
      }));
      toast({ title: "API key test failed", description: msg });
    }
  };

  const testAllKeys = async () => {
    const keys = apiKeys[provider] ?? [];
    if (!keys.length) return;
    for (let i = 0; i < keys.length; i++) {
      // sequential to avoid hammering provider
      // eslint-disable-next-line no-await-in-loop
      await testKeyAt(i);
    }
  };

  const removeKeyAt = (idx: number) => {
    setApiKeys((p) => ({ ...p, [provider]: (p[provider] ?? []).filter((_, i) => i !== idx) }));
    setActiveKeyIndex((p) => ({ ...p, [provider]: 0 }));
  };

  const clearAllKeysForProvider = () => {
    setApiKeys((p) => ({ ...p, [provider]: [] }));
    setActiveKeyIndex((p) => ({ ...p, [provider]: 0 }));
    setNewKeyInput("");
  };

  const shouldTryNextKey = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    const status = (() => {
      const m = msg.match(/\[(\d{3})\]/);
      return m ? Number(m[1]) : null;
    })();
    // Don't rotate on payload/format issues; rotating keys won't help.
    if (status === 413 || status === 400) return false;
    // If it's auth-related or unknown, try next key.
    if (status === 401 || status === 403) return true;
    if (/invalid|unauthorized|api key|key/i.test(msg)) return true;
    // For rate limits, switching keys *might* help, but can also burn keys.
    // Only rotate if the user has multiple keys.
    if (status === 429) return true;
    return false;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const isBlank = (v: string | null | undefined) => !v || !v.trim();

  const waitWhilePaused = async () => {
    while (pauseRef.current) {
      await sleep(200);
    }
  };

  const runGeneration = async (targetIds?: Set<string>) => {
    const keys = (apiKeys[provider] ?? []).filter(Boolean);
    if (keys.length === 0) {
      toast({ title: "API key required", description: "Add one (or more) API keys to continue." });
      return;
    }
    if (!items.length) return;

    try {
      setIsGenerating(true);
      setIsPaused(false);
      pauseRef.current = false;

      const baseStart = Math.min(activeKeyIndex[provider] ?? 0, Math.max(0, keys.length - 1));

      const generateOne = async (it: BatchItem) => {
        setSelectedId(it.id);
        setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: "generating", error: undefined } : x)));

        const img = await fileToBase64(it.file);

        const start = baseStart;
        const order = [...keys.slice(start), ...keys.slice(0, start)];

        const runOnce = async (promptText: string) => {
          if (!limiter.current.canRun()) {
            await sleep(limiter.current.msUntilNext());
          }
          limiter.current.markRun();

          let lastErr: unknown = null;
          let usedIndex: number | null = null;
          let text: string | null = null;

          for (let i = 0; i < order.length; i++) {
            const key = order[i];
            try {
              text = await generateWithProvider({ provider, apiKey: key.trim(), prompt: promptText, image: img });
              usedIndex = (start + i) % keys.length;
              break;
            } catch (e) {
              lastErr = e;
              if (!shouldTryNextKey(e) || i === order.length - 1) break;
            }
          }

          if (usedIndex !== null) setActiveKeyIndex((p) => ({ ...p, [provider]: usedIndex! }));
          return { text, lastErr };
        };

        const mergeIfMissing = (base: MetaGenOutput, patch: MetaGenOutput): MetaGenOutput => {
          return {
            ...base,
            title: isBlank(base.title) ? patch.title : base.title,
            description: isBlank(base.description) ? patch.description : base.description,
            altText: isBlank(base.altText) ? patch.altText : base.altText,
            keywords: isBlank(base.keywords) ? patch.keywords : base.keywords,
            hashtags: isBlank(base.hashtags) ? patch.hashtags : base.hashtags,
            categories: isBlank(base.categories) ? patch.categories : base.categories,
          };
        };

        const fillMissingRequiredFields = async (current: MetaGenOutput) => {
          let out = current;
          const missing = getMissingRequiredFields(out);
          if (!missing.length) return out;

          // Targeted follow-ups are more reliable than a full re-run when only one field is missing.
          for (const field of missing) {
            const label = field === "altText" ? "ALT_TEXT" : field === "keywords" ? "KEYWORDS" : "CATEGORIES";
            const fieldPrompt = `${prompt}

TARGETED REPAIR (important):
- Generate ONLY the ${label} field for the image.
- Return EXACTLY one line in this format: ${label}: <value>
- The value must be NON-EMPTY.
${label === "KEYWORDS" ? `- KEYWORDS must be EXACTLY ${controls.keywordCount} items, comma-separated.` : ""}
- Do NOT include any other labels, headings, markdown, or explanation.`;

            const res = await runOnce(fieldPrompt);
            if (!res.text) continue;

            const parsedPatch = parseMetadataText(res.text);
            out = mergeIfMissing(out, parsedPatch);
          }

          return out;
        };

        const first = await runOnce(prompt);
        if (!first.text) {
          const msg = first.lastErr instanceof Error ? first.lastErr.message : "Unknown error";
          setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: "error", error: msg } : x)));
          return;
        }

        let parsed = enforceConstraints(parseMetadataText(first.text), controls);

        // Recovery strategy (bounded):
        // 1) One strict full-format retry
        // 2) Targeted per-field repair for any remaining missing required fields
        if (!hasAllRequiredFields(parsed)) {
          const missing = getMissingRequiredFields(parsed);
          const missingLabels = missing
            .map((m) => (m === "altText" ? "ALT_TEXT" : m === "keywords" ? "KEYWORDS" : "CATEGORIES"))
            .join(", ");

          const repairPrompt = `${prompt}

REPAIR INSTRUCTIONS (important):
- Your previous response was missing or empty: ${missingLabels}
- Return ALL fields in the exact format:
TITLE:\nDESCRIPTION:\nALT_TEXT:\nKEYWORDS:\nHASHTAGS:\nCATEGORIES:
- Every field must be NON-EMPTY (no placeholders like N/A)
- KEYWORDS must be EXACTLY ${controls.keywordCount} items, comma-separated
- Output ONLY the fields (no extra text)`;

          const retry = await runOnce(repairPrompt);
          if (retry.text) {
            const repaired = parseMetadataText(retry.text);
            parsed = mergeIfMissing(parsed, repaired);
          }

          if (!hasAllRequiredFields(parsed)) {
            parsed = await fillMissingRequiredFields(parsed);
          }
        }

        // If it STILL fails on required fields, make it visible as an error.
        if (!hasAllRequiredFields(parsed)) {
          const missing = getMissingRequiredFields(parsed)
            .map((m) => (m === "altText" ? "ALT_TEXT" : m === "keywords" ? "KEYWORDS" : "CATEGORIES"))
            .join(", ");
          setItems((p) =>
            p.map((x) =>
              x.id === it.id ? { ...x, status: "error", error: `Missing required fields after retries: ${missing}` } : x,
            ),
          );
          return;
        }

        // CONSTRAINT VALIDATION & REPAIR
        // Check if title/description length and keyword count meet user's constraints
        const applyConstraintFix = (base: MetaGenOutput, patch: MetaGenOutput, issues: ConstraintIssues): MetaGenOutput => ({
          ...base,
          title: (issues.titleTooShort || issues.titleTooLong) && patch.title?.trim() ? patch.title : base.title,
          description: (issues.descTooShort || issues.descTooLong) && patch.description?.trim() ? patch.description : base.description,
          keywords: (issues.keywordsTooFew || issues.keywordsTooMany) && patch.keywords?.trim() ? patch.keywords : base.keywords,
        });

        let constraintIssues = checkConstraints(parsed, controls);
        
        // Try up to 2 constraint repair attempts
        for (let attempt = 0; attempt < 2 && hasConstraintIssues(constraintIssues); attempt++) {
          const repairPrompt = buildConstraintRepairPrompt(controls, constraintIssues, {
            title: parsed.title,
            description: parsed.description,
            keywords: parsed.keywords,
          });
          
          const repairRes = await runOnce(repairPrompt);
          if (repairRes.text) {
            const repairParsed = enforceConstraints(parseMetadataText(repairRes.text), controls);
            parsed = applyConstraintFix(parsed, repairParsed, constraintIssues);
            parsed = enforceConstraints(parsed, controls);
            constraintIssues = checkConstraints(parsed, controls);
          }
        }

        setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: "done", output: parsed } : x)));
      };

      for (const it of items) {
        if (targetIds && !targetIds.has(it.id)) continue;
        if (it.status === "generating") continue;
        if (!targetIds && it.status === "done") continue;
        
        // Wait if paused before processing each item
        await waitWhilePaused();
        
        // eslint-disable-next-line no-await-in-loop
        await generateOne(it);
      }

      toast({ title: "Batch complete", description: "Review results and export CSV." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Generation failed", description: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  const onGenerate = async () => {
    await runGeneration();
  };

  const togglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    pauseRef.current = next;
    toast({ 
      title: next ? "Generation paused" : "Generation resumed", 
      description: next ? "Click Resume to continue processing." : "Processing will continue." 
    });
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard permission blocked by your browser." });
    }
  };

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);
  const selectedOutput: MetaGenOutput = selected?.output ?? { ...emptyOutput };
  const copyAll = () => copy("All fields", toPlainText(selectedOutput));

  const editorItem = useMemo(() => items.find((x) => x.id === editorId) ?? null, [items, editorId]);

  const exportAll = (marketplace: MarketplaceExport) => {
    const rows = items
      .filter((x) => x.status === "done" && x.output)
      .map((x) => ({ filename: x.file.name, output: x.output! }));
    if (!rows.length) {
      toast({ title: "Nothing to export", description: "Generate at least one image first." });
      return;
    }
    const suffix = marketplace === "generic" ? "batch" : marketplace;
    downloadText(`metagen-${suffix}.csv`, batchToMarketplaceCSV(rows, marketplace), "text/csv");
  };

  const exportRowCSV = (marketplace: MarketplaceExport, filename: string, o: MetaGenOutput) => {
    const base = filename.replace(/\.[^.]+$/, "");
    const suffix = marketplace === "generic" ? "metadata" : marketplace;
    downloadText(`${base}-${suffix}.csv`, batchToMarketplaceCSV([{ filename, output: o }], marketplace), "text/csv");
  };

  const regenerateRow = async (id: string) => {
    const keys = (apiKeys[provider] ?? []).filter(Boolean);
    if (keys.length === 0) {
      toast({ title: "API key required", description: "Add one (or more) API keys to continue." });
      return;
    }
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (isGenerating) {
      toast({ title: "Busy", description: "Wait for the current generation to finish." });
      return;
    }

    setItems((p) => p.map((x) => (x.id === id ? { ...x, status: "queued", error: undefined } : x)));
    setSelectedId(id);
    await runGeneration(new Set([id]));
  };

  return (
    <div className="min-h-screen metagen-hero">
      <WorkspaceHeader
        queuedCount={items.length}
        canGenerate={canGenerate}
        isGenerating={isGenerating}
        onPickFiles={onPickFiles}
        onGenerate={onGenerate}
        onExportAll={exportAll}
        downloadableItems={items.filter((x) => x.status === "done" && x.output).map((x) => ({ file: x.file, output: x.output! }))}
        onCopySelected={copyAll}
        onOpenSettings={() => setDetailsOpen(true)}
      />

      <main className="container py-6">
        {items.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-foreground">Upload Images</h1>
              <p className="text-muted-foreground mt-1">Add images to generate SEO-optimized metadata</p>
            </div>
            <DropZone onFilesSelected={onPickFiles} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">Batch results</h1>
                <p className="text-sm text-muted-foreground">Each row shows the image (left) and generated metadata (right). Exports use the toolbar above.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Rate limit: 1 req / 6s</span>
                {isGenerating && (
                  <Button
                    type="button"
                    variant={isPaused ? "default" : "outline"}
                    size="sm"
                    onClick={togglePause}
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-4 w-4" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4" />
                        Pause
                      </>
                    )}
                  </Button>
                )}
                {items.some((x) => x.status === "done") && !isGenerating && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const doneIds = new Set(items.filter((x) => x.status === "done").map((x) => x.id));
                      if (!doneIds.size) return;
                      setItems((p) => p.map((x) => (doneIds.has(x.id) ? { ...x, status: "queued", error: undefined } : x)));
                      await runGeneration(doneIds);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-generate All
                  </Button>
                )}
                {items.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      for (const it of items) URL.revokeObjectURL(it.previewUrl);
                      setItems([]);
                      setSelectedId(null);
                      setEditorId(null);
                      setIsGenerating(false);
                      setIsPaused(false);
                      pauseRef.current = false;
                      toast({ title: "Cleared", description: "All results have been removed." });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <BatchResultsTable
                items={items}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                }}
                onEdit={(id) => {
                  setEditorId(id);
                  setSelectedId(id);
                  setEditorOpen(true);
                }}
                onRemove={(id) => {
                  setItems((p) => {
                    const it = p.find((x) => x.id === id);
                    if (it) URL.revokeObjectURL(it.previewUrl);
                    return p.filter((x) => x.id !== id);
                  });
                  setSelectedId((p) => (p === id ? null : p));
                  setEditorId((p) => (p === id ? null : p));
                }}
                onExportRow={exportRowCSV}
                onRegenerate={regenerateRow}
              />
            </div>

          </>
        )}
      </main>

      <MetadataEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        filename={editorItem?.file.name ?? null}
        previewUrl={editorItem?.previewUrl ?? null}
        value={editorItem?.output ?? null}
        onSave={(next) => {
          if (!editorId) return;
          setItems((p) => p.map((x) => (x.id === editorId ? { ...x, output: { ...(x.output ?? emptyOutput), ...next } } : x)));
        }}
      />

      <MetaGenDetailsDrawer
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        selectedFilename={selected?.file.name ?? null}
        selectedPreviewUrl={selected?.previewUrl ?? null}
        selectedStatus={selected?.status ?? null}
        selectedOutput={selected?.output ?? null}
        onUpdateOutput={(next) => {
          if (!selectedId) return;
          setItems((p) => p.map((x) => (x.id === selectedId ? { ...x, output: { ...(x.output ?? emptyOutput), ...next } } : x)));
        }}
        onCopyField={(label, value) => copy(label, value)}
        provider={provider}
        setProvider={(p) => setProvider(p)}
        newKeyInput={newKeyInput}
        setNewKeyInput={setNewKeyInput}
        addKey={addKey}
        currentKeys={currentKeys}
        activeKeyIndex={currentActiveIndex}
        setActiveKeyIndex={(idx) => setActiveKeyIndex((p) => ({ ...p, [provider]: idx }))}
        keyTestState={keyTestState[provider] ?? {}}
        testKeyAt={testKeyAt}
        testAllKeys={testAllKeys}
        removeKeyAt={removeKeyAt}
        clearAllKeysForProvider={clearAllKeysForProvider}
        currentKeysCount={currentKeys.length}
        currentActiveIndex={currentActiveIndex}
        controls={controls}
        setControls={setControls}
      />

      <SupportPopup />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onCopy,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onCopy: () => void;
  rows?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{label}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onCopy}>
            <Copy /> Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} />
      </CardContent>
    </Card>
  );
}
