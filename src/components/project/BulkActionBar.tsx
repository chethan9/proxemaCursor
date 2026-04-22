import { Button } from "@/components/ui/button";
import { X, RefreshCw, Download } from "lucide-react";

interface Props {
  selectedCount: number;
  onSync: () => void;
  onExport: () => void;
  onClear: () => void;
  syncing?: boolean;
}

export function BulkActionBar({ selectedCount, onSync, onExport, onClear, syncing }: Props) {
  if (selectedCount === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border border-border bg-card shadow-xl px-3 py-2">
      <span className="text-sm font-medium pl-1">{selectedCount} site{selectedCount !== 1 ? "s" : ""} selected</span>
      <div className="h-5 w-px bg-border mx-1" />
      <Button size="sm" variant="default" onClick={onSync} disabled={syncing}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Enqueueing…" : "Sync selected"}
      </Button>
      <Button size="sm" variant="outline" onClick={onExport}>
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Export CSV
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="h-3.5 w-3.5 mr-1.5" />
        Clear
      </Button>
    </div>
  );
}