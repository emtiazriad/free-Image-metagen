import { AlertTriangle, CircleHelp, ExternalLink, KeyRound, SlidersHorizontal } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

import type { MetaGenControls, MetaGenOutput, ProviderId } from "@/lib/metagen/types";
import { emptyOutput } from "@/lib/metagen/types";

export function MetaGenDetailsDrawer({
  open,
  onOpenChange,
  selectedFilename,
  selectedPreviewUrl,
  selectedStatus,
  selectedOutput,
  onUpdateOutput,
  onCopyField,
  provider,
  setProvider,
  newKeyInput,
  setNewKeyInput,
  addKey,
  currentKeys,
  activeKeyIndex,
  setActiveKeyIndex,
  keyTestState,
  testKeyAt,
  testAllKeys,
  removeKeyAt,
  clearAllKeysForProvider,
  currentKeysCount,
  currentActiveIndex,
  controls,
  setControls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFilename: string | null;
  selectedPreviewUrl: string | null;
  selectedStatus: string | null;
  selectedOutput: MetaGenOutput | null;
  onUpdateOutput: (next: Partial<MetaGenOutput>) => void;
  onCopyField: (label: string, value: string) => void;

  provider: ProviderId;
  setProvider: (p: ProviderId) => void;

  newKeyInput: string;
  setNewKeyInput: (v: string) => void;
  addKey: () => void;
  currentKeys: string[];
  activeKeyIndex: number;
  setActiveKeyIndex: (idx: number) => void;
  keyTestState: Record<number, { status: "idle" | "testing" | "valid" | "invalid"; code?: number; message?: string; at?: number }>;
  testKeyAt: (idx: number) => void;
  testAllKeys: () => void;
  removeKeyAt: (idx: number) => void;
  clearAllKeysForProvider: () => void;
  currentKeysCount: number;
  currentActiveIndex: number;

  controls: MetaGenControls;
  setControls: (next: MetaGenControls | ((p: MetaGenControls) => MetaGenControls)) => void;
}) {
  const o = selectedOutput ?? { ...emptyOutput };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] max-w-[92vw] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{selectedFilename ?? "Workspace"}</span>
              {selectedStatus ? (
                <Badge variant={selectedStatus === "done" ? "default" : selectedStatus === "error" ? "destructive" : "secondary"}>
                  {selectedStatus}
                </Badge>
              ) : null}
            </SheetTitle>
            <SheetDescription>Settings: manage provider keys and tune prompt controls.</SheetDescription>
          </SheetHeader>

          <Separator />

          <div className="min-h-0 flex-1 overflow-auto p-6">
            {selectedPreviewUrl ? (
              <div className="mb-6 overflow-hidden rounded-lg border bg-card">
                <img src={selectedPreviewUrl} alt={selectedFilename ? `${selectedFilename} preview` : "Selected image preview"} className="h-48 w-full object-cover" loading="lazy" />
              </div>
            ) : null}

            <div className="w-full space-y-4">
              {/* Prompt controls first */}
              <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <SlidersHorizontal className="h-4 w-4" /> Prompt controls
                    </CardTitle>
                    <CardDescription>These limits are injected into the prompt.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-2">
                      <Label>Title length: Min {controls.titleLengthMin} – Max {controls.titleLengthMax}</Label>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-muted-foreground w-8">Min</span>
                        <Slider 
                          value={[controls.titleLengthMin]} 
                          min={20} 
                          max={controls.titleLengthMax - 10} 
                          step={5} 
                          onValueChange={([v]) => setControls((p) => ({ ...p, titleLengthMin: v }))} 
                        />
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-muted-foreground w-8">Max</span>
                        <Slider 
                          value={[controls.titleLengthMax]} 
                          min={controls.titleLengthMin + 10} 
                          max={250} 
                          step={5} 
                          onValueChange={([v]) => setControls((p) => ({ ...p, titleLengthMax: v }))} 
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Description length: Min {controls.descLengthMin} – Max {controls.descLengthMax}</Label>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-muted-foreground w-8">Min</span>
                        <Slider 
                          value={[controls.descLengthMin]} 
                          min={50} 
                          max={controls.descLengthMax - 20} 
                          step={10} 
                          onValueChange={([v]) => setControls((p) => ({ ...p, descLengthMin: v }))} 
                        />
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-muted-foreground w-8">Max</span>
                        <Slider 
                          value={[controls.descLengthMax]} 
                          min={controls.descLengthMin + 20} 
                          max={500} 
                          step={10} 
                          onValueChange={([v]) => setControls((p) => ({ ...p, descLengthMax: v }))} 
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Keywords count ({controls.keywordCount})</Label>
                      <Slider value={[controls.keywordCount]} min={5} max={50} step={1} onValueChange={([v]) => setControls((p) => ({ ...p, keywordCount: v }))} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Positive keywords <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Textarea
                        value={controls.positiveKeywords ?? ""}
                        onChange={(e) => setControls((p) => ({ ...p, positiveKeywords: e.target.value }))}
                        placeholder="e.g. sunset, travel, adventure, golden hour"
                        rows={2}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">Keywords/concepts to include in the generated metadata.</p>
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label>Keyword style</Label>
                        <Select value={controls.keywordStyle} onValueChange={(v) => setControls((p) => ({ ...p, keywordStyle: v as any }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SEO Focused">SEO Focused</SelectItem>
                            <SelectItem value="Stock Photography">Stock Photography</SelectItem>
                            <SelectItem value="Social Media">Social Media</SelectItem>
                            <SelectItem value="Artistic">Artistic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Tone</Label>
                        <Select value={controls.tone} onValueChange={(v) => setControls((p) => ({ ...p, tone: v as any }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Professional">Professional</SelectItem>
                            <SelectItem value="Creative">Creative</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Technical">Technical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
              </Card>

              {/* Provider section below */}
              <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" /> Provider
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          const url = provider === "gemini" 
                            ? "https://aistudio.google.com/app/apikey" 
                            : "https://console.groq.com/keys";
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Get API Key
                      </Button>
                    </CardTitle>
                    <CardDescription>API keys are stored locally in your browser.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2">
                      <Label>Provider</Label>
                      <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Gemini</SelectItem>
                          <SelectItem value="groq">Groq</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Add API key</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newKeyInput}
                          onChange={(e) => setNewKeyInput(e.target.value)}
                          placeholder="Paste API key"
                          type="password"
                          autoComplete="off"
                        />
                        <Button type="button" variant="soft" onClick={addKey} disabled={!newKeyInput.trim()}>
                          Add
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {currentKeysCount ? <>Saved keys: {currentKeysCount} • Active: {currentActiveIndex + 1}</> : <span className="inline-flex items-center gap-1"><CircleHelp className="h-3.5 w-3.5" /> No keys yet</span>}
                      </div>
                      {currentKeysCount < 5 && (
                        <Alert className="mt-2 border-destructive/50 bg-destructive/10">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <AlertDescription className="text-destructive">
                            Minimum 5 API keys recommended for rate limitation.
                          </AlertDescription>
                        </Alert>
                      )}
                      </div>

                    <div className="rounded-lg border bg-background/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-medium">Saved keys</div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={testAllKeys} disabled={!currentKeys.length}>
                            Test all
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={clearAllKeysForProvider} disabled={!currentKeys.length}>
                            Clear
                          </Button>
                        </div>
                      </div>

                      {currentKeys.length ? (
                        <div className="mt-3 grid gap-2">
                          {currentKeys.map((k, idx) => {
                            const masked = k.length <= 10 ? "••••••••" : `${k.slice(0, 4)}••••••••${k.slice(-4)}`;
                            const isActive = idx === activeKeyIndex;
                            const test = keyTestState?.[idx];
                            const badge = (() => {
                              if (!test || test.status === "idle") return <Badge variant="secondary">Untested</Badge>;
                              if (test.status === "testing") return <Badge variant="secondary">Testing</Badge>;
                              if (test.status === "valid") return <Badge>Valid</Badge>;
                              return <Badge variant="destructive">Invalid</Badge>;
                            })();
                            return (
                              <div key={`${masked}-${idx}`} className="flex flex-col gap-2 rounded-md border bg-background px-2 py-2 overflow-hidden">
                                <button
                                  type="button"
                                  className="flex items-center justify-between gap-2 text-left text-xs min-w-0 w-full"
                                  onClick={() => setActiveKeyIndex(idx)}
                                  title="Set as active key"
                                >
                                  <span className="font-mono text-muted-foreground truncate min-w-0 flex-shrink">{masked}</span>
                                  <span className="inline-flex items-center gap-2 flex-shrink-0">
                                    {badge}
                                    {isActive ? <Badge variant="secondary">Active</Badge> : null}
                                  </span>
                                </button>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <Button type="button" variant="outline" size="sm" onClick={() => testKeyAt(idx)} disabled={test?.status === "testing"}>
                                    Test
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => removeKeyAt(idx)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
