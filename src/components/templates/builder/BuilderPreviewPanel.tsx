"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type PreviewDevice = "full" | "tablet" | "mobile";

export type BuilderPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewSrc: string;
  previewKey: number;
  onRefresh: () => void;
  onOpenInTab: () => void;
};

const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  full: "100%",
  tablet: "780px",
  mobile: "390px",
};

export function BuilderPreviewDialog({ open, onOpenChange, previewSrc, previewKey, onRefresh, onOpenInTab }: BuilderPreviewDialogProps) {
  const [device, setDevice] = useState<PreviewDevice>("full");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(1280px,96vw)] w-[min(1280px,96vw)] h-[92vh] p-0 gap-0 overflow-hidden border border-slate-200 sm:rounded-xl bg-white grid-rows-[auto_1fr]"
        showClose={false}
      >
        <div className="h-12 px-3 sm:px-4 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-slate-900">Live preview</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">— sample data</span>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 p-0.5 bg-slate-50">
              <DeviceButton active={device === "full"} onClick={() => setDevice("full")} aria="Desktop">
                <Monitor className="h-3.5 w-3.5" />
              </DeviceButton>
              <DeviceButton active={device === "tablet"} onClick={() => setDevice("tablet")} aria="Tablet">
                <Tablet className="h-3.5 w-3.5" />
              </DeviceButton>
              <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} aria="Mobile">
                <Smartphone className="h-3.5 w-3.5" />
              </DeviceButton>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 border-slate-200 text-xs gap-1.5" onClick={onRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 border-slate-200 text-xs gap-1.5 hidden sm:inline-flex" onClick={onOpenInTab}>
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => onOpenChange(false)} aria-label="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-slate-100 p-4 flex justify-center">
          <div
            className="h-full min-h-[200px] bg-white shadow-md border border-slate-200 rounded-md overflow-hidden transition-[width] duration-200"
            style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
          >
            <iframe
              key={previewKey}
              src={previewSrc}
              sandbox="allow-same-origin"
              className="w-full h-full min-h-[400px] border-0 bg-white"
              title="Template preview"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeviceButton({ active, onClick, aria, children }: { active: boolean; onClick: () => void; aria: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={`${aria} width`}
      onClick={onClick}
      className={cn(
        "h-7 w-8 rounded-md flex items-center justify-center text-slate-500 transition-colors",
        active ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}
