import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableLoadingOverlayProps {
  show: boolean;
  label?: string;
  className?: string;
}

export function TableLoadingOverlay({ show, label = "Updating…", className }: TableLoadingOverlayProps) {
  const [render, setRender] = useState(show);

  useEffect(() => {
    if (show) {
      setRender(true);
      return;
    }
    const t = setTimeout(() => setRender(false), 250);
    return () => clearTimeout(t);
  }, [show]);

  if (!render) return null;

  return (
    <div
      aria-hidden={!show}
      className={cn(
        "pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 transition-all duration-200",
        show ? "opacity-100 scale-100" : "opacity-0 scale-95",
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