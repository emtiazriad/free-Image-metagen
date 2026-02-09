import { Download, LoaderCircle, Pencil, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MetaGenOutput } from "@/lib/metagen/types";
import type { MarketplaceExport } from "@/lib/metagen/batchExport";

export type BatchItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "generating" | "done" | "error";
  error?: string;
  output?: MetaGenOutput;
};

export function BatchResultsTable({
  items,
  selectedId,
  onSelect,
  onRemove,
  onExportRow,
  onRegenerate,
  onEdit,
}: {
  items: BatchItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onRemove: (id: string) => void;
  onExportRow: (marketplace: MarketplaceExport, filename: string, output: MetaGenOutput) => void;
  onRegenerate: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const statusBadge = (it: BatchItem) => {
    if (it.status === "queued") return <Badge variant="secondary">Queued</Badge>;
    if (it.status === "generating") {
      return (
        <Badge variant="secondary" className="gap-1">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Running
        </Badge>
      );
    }
    if (it.status === "done") return <Badge>Done</Badge>;
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3.5 w-3.5" /> Error
      </Badge>
    );
  };

  const doneCount = items.filter((it) => it.status === "done").length;
  const totalCount = items.length;
  const generatingCount = items.filter((it) => it.status === "generating").length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Progress indicator */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Progress:</span>
          <span className="text-muted-foreground">
            {doneCount} / {totalCount} generated
          </span>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[88px]">Image</TableHead>
            <TableHead>Generated metadata</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
             <TableHead className="max-w-0">Generated metadata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow
              key={it.id}
              className={
                "cursor-pointer " +
                (selectedId === it.id ? "bg-muted/60 hover:bg-muted/60" : "")
              }
              onClick={() => onSelect?.(it.id)}
            >
              <TableCell>
                <div className="h-14 w-14 overflow-hidden rounded-md border bg-background">
                  <img src={it.previewUrl} alt={`${it.file.name} preview`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              </TableCell>
              <TableCell>
                <div className="min-w-0 space-y-2">
                  <TableCell className="max-w-0 overflow-hidden">
                  <div className="min-w-0 max-w-full space-y-2 overflow-hidden">
                    {it.error ? <div className="truncate text-xs text-destructive">{it.error}</div> : null}
                  </div>

                  <div className="grid gap-2">
                    <div className="grid gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">TITLE</span>
                        {it.output?.title && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                            {it.output.title.length} chars
                          </Badge>
                        )}
                      </div>
                      <div className="line-clamp-2 text-sm">{it.output?.title ?? "—"}</div>
                    </div>

                    <div className="grid gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">DESCRIPTION</span>
                        {it.output?.description && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                            {it.output.description.length} chars
                          </Badge>
                        )}
                      </div>
                      <div className="line-clamp-3 text-sm text-muted-foreground">{it.output?.description ?? "—"}</div>
                    </div>

                    <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
                      <div className="grid gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">KEYWORDS</span>
                          {it.output?.keywords && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                              {it.output.keywords.split(",").filter(k => k.trim()).length} keywords
                            </Badge>
                          )}
                        </div>
                        <div className="line-clamp-2 text-sm text-muted-foreground">{it.output?.keywords ?? "—"}</div>
                      </div>
                      <div className="grid gap-1">
                        <div className="text-[11px] font-medium text-muted-foreground">CATEGORIES</div>
                        <div className="line-clamp-2 text-sm text-muted-foreground">{it.output?.categories ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>{statusBadge(it)}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={!it.output} onClick={() => onEdit(it.id)}>
                    <Pencil />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={it.status === "generating"} onClick={() => onRegenerate(it.id)}>
                    <RotateCcw />
                    <span className="hidden sm:inline">Regenerate</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={!it.output}>
                        <Download />
                        <span className="hidden sm:inline">Export</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => it.output && onExportRow("generic", it.file.name, it.output)}>
                        Generic CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("adobe_stock", it.file.name, it.output)}>
                        Adobe Stock CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("shutterstock", it.file.name, it.output)}>
                        Shutterstock CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("freepik", it.file.name, it.output)}>
                        Freepik CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("pond5", it.file.name, it.output)}>
                        Pond5 CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("istock", it.file.name, it.output)}>
                        iStock CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("alamy", it.file.name, it.output)}>
                        Alamy CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("dreamstime", it.file.name, it.output)}>
                        Dreamstime CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => it.output && onExportRow("123rf", it.file.name, it.output)}>
                        123RF CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button type="button" variant="outline" size="sm" onClick={() => onRemove(it.id)}>
                    Remove
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
