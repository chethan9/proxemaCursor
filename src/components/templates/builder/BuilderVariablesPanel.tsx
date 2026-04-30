"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy as CopyIcon, Search } from "lucide-react";
import type { VariableGroup } from "@/lib/templates/templateVariableGroups";

export type BuilderVariablesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: VariableGroup[];
  onCopyToken: (token: string) => void;
};

export function BuilderVariablesDialog({ open, onOpenChange, groups, onCopyToken }: BuilderVariablesDialogProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.token.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[min(640px,96vw)] h-[80vh] p-0 gap-0 overflow-hidden border border-slate-200 sm:rounded-xl bg-white grid-rows-[auto_auto_1fr]">
        <div className="px-4 pt-4 pb-1">
          <DialogTitle className="text-base font-semibold text-slate-900">Variables &amp; helpers</DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Blocks ship with sample data so the canvas looks real. To make a value dynamic,
            tap a token below to copy it, then paste over the dummy text in your block.
          </p>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens…"
              className="h-9 pl-8 text-sm border-slate-200"
            />
          </div>
        </div>
        <ScrollArea className="min-h-0">
          <div className="px-3 pb-4 space-y-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No tokens match.</p>
            ) : null}
            {filtered.map((g) => (
              <section key={g.label}>
                <h3 className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold px-2 mb-1.5">{g.label}</h3>
                <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                  {g.items.map((item) => (
                    <button
                      type="button"
                      key={item.token}
                      onClick={() => onCopyToken(item.token)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 group flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="text-[11px] font-mono text-primary block truncate">{item.token}</code>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</div>
                      </div>
                      <CopyIcon className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 mt-1 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
