import { Copy, Download, Heart, Mail, Menu, Settings2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/metagen/ThemeToggle";
import { DownloadWithEmbeddingButton } from "@/components/metagen/DownloadWithEmbeddingButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { MarketplaceExport } from "@/lib/metagen/batchExport";
import type { MetaGenOutput } from "@/lib/metagen/types";

export function WorkspaceHeader({
  queuedCount,
  canGenerate,
  isGenerating,
  onPickFiles,
  onGenerate,
  onExportAll,
  downloadableItems,
  onCopySelected,
  onOpenSettings,
}: {
  queuedCount: number;
  canGenerate: boolean;
  isGenerating: boolean;
  onPickFiles: (files: FileList | null) => void;
  onGenerate: () => void;
  onExportAll: (marketplace: MarketplaceExport) => void;
  downloadableItems: Array<{ file: File; output: MetaGenOutput }>;
  onCopySelected: () => void;
  onOpenSettings: () => void;
}) {
  const ExportDropdown = ({ fullWidth = false }: { fullWidth?: boolean }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className={fullWidth ? "w-full justify-start" : ""}>
            <Download /> Export CSV
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover z-50">
          <DropdownMenuItem onClick={() => onExportAll("generic")}>Generic CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("adobe_stock")}>Adobe Stock CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("shutterstock")}>Shutterstock CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("freepik")}>Freepik CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("pond5")}>Pond5 CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("istock")}>iStock CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("alamy")}>Alamy CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("dreamstime")}>Dreamstime CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportAll("123rf")}>123RF CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-14 items-center justify-between gap-2">
        <div className="min-w-0 flex-shrink">
          <div className="truncate text-sm font-semibold leading-none">Free-ImageMetagen</div>
          <div className="truncate text-xs text-muted-foreground hidden xs:block">Pro workspace</div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Core actions - always visible */}
          <label className="inline-flex">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              multiple
              className="sr-only"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4" />
                <span className="hidden xs:inline ml-1">Upload</span>
                <span className="ml-1 text-muted-foreground">({queuedCount})</span>
              </span>
            </Button>
          </label>

          <Button type="button" variant="hero" size="sm" disabled={!canGenerate} onClick={onGenerate}>
            {isGenerating ? "..." : "Generate"}
          </Button>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <DownloadWithEmbeddingButton items={downloadableItems} disabled={downloadableItems.length === 0} />
            <ExportDropdown />
            <Button type="button" variant="outline" size="sm" onClick={onCopySelected}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-primary border-primary/30 hover:bg-primary/10"
              asChild
            >
              <a href="mailto:mdemtiazahmed11@gmail.com">
                <Mail className="h-4 w-4" /> Contact
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-pink-500 border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-400"
              asChild
            >
              <a href="https://www.supportkori.com/emtiaz" target="_blank" rel="noopener noreferrer">
                <Heart className="h-4 w-4 fill-current" /> Support
              </a>
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Open settings" onClick={onOpenSettings}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>

          {/* Mobile menu - hidden on desktop (md and above) */}
          <div className="md:hidden flex items-center gap-1.5">
            <Button type="button" variant="outline" size="icon" aria-label="Open settings" onClick={onOpenSettings}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <SheetHeader className="p-4 pb-2 border-b">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 p-4">
                  <DownloadWithEmbeddingButton items={downloadableItems} disabled={downloadableItems.length === 0} />
                  <ExportDropdown fullWidth />
                  
                  <Button type="button" variant="outline" size="sm" onClick={onCopySelected} className="w-full justify-start">
                    <Copy className="h-4 w-4" /> Copy Selected
                  </Button>

                  <div className="my-2 h-px bg-border" />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-primary border-primary/30 hover:bg-primary/10"
                    asChild
                  >
                    <a href="mailto:mdemtiazahmed11@gmail.com">
                      <Mail className="h-4 w-4" /> Contact Us
                    </a>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-pink-500 border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-400"
                    asChild
                  >
                    <a href="https://www.supportkori.com/emtiaz" target="_blank" rel="noopener noreferrer">
                      <Heart className="h-4 w-4 fill-current" /> Support Project
                    </a>
                  </Button>

                  <div className="my-2 h-px bg-border" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
