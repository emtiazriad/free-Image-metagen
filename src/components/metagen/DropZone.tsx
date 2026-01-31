import { useCallback, useState } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFilesSelected: (files: FileList | null) => void;
  className?: string;
}

export function DropZone({ onFilesSelected, className }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  return (
    <label
      className={cn(
        "relative flex flex-col items-center justify-center w-full min-h-[320px] md:min-h-[400px] rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group",
        isDragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        multiple
        className="sr-only"
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <div
        className={cn(
          "flex flex-col items-center gap-4 p-8 transition-transform duration-200",
          isDragOver && "scale-105"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center w-20 h-20 rounded-full transition-colors duration-200",
            isDragOver
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )}
        >
          {isDragOver ? (
            <ImagePlus className="w-10 h-10" />
          ) : (
            <Upload className="w-10 h-10" />
          )}
        </div>

        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">
            {isDragOver ? "Drop your images here" : "Drag & drop your images"}
          </p>
          <p className="text-sm text-muted-foreground">
            or <span className="text-primary font-medium underline-offset-2 hover:underline">browse files</span>
          </p>
          <p className="text-xs text-muted-foreground/70 pt-2">
            Supports JPG, PNG, WEBP, GIF, SVG
          </p>
        </div>
      </div>

      {/* Animated corner accents */}
      <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-primary/40 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-primary/40 rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-primary/40 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-primary/40 rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity" />
    </label>
  );
}
