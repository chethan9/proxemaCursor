import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableLoadingOverlayProps {
  show: boolean;
  label?: string;
  className?: string;
}

export function TableLoadingOverlay({ show, label = "Updating…", className }: TableLoadingOverlayProps) {
  return (
    <div
      aria-hidden={!show}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200",
        show ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>{label}</span>
      </div>
    </div>
  );
}