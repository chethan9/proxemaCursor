"use client";

import { useEffect, useState } from "react";
import type { Editor } from "grapesjs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { MousePointerClick, Search, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaletteTab } from "@/lib/templates/templateBuilderPalette";
import { blockMatchesPaletteTab } from "@/lib/templates/templateBuilderPalette";

export type BuilderLeftPanelProps = {
  blockHostId: string;
  editor: Editor | null;
  blockSearch: string;
  onBlockSearchChange: (q: string) => void;
  filenamePattern: string;
  onFilenamePatternChange: (pattern: string) => void;
  filenameDisabled?: boolean;
};

export function BuilderLeftPanel({
  blockHostId,
  editor,
  blockSearch,
  onBlockSearchChange,
  filenamePattern,
  onFilenamePatternChange,
  filenameDisabled,
}: BuilderLeftPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [paletteTab, setPaletteTab] = useState<PaletteTab>("elements");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!editor) return;
    const container = document.getElementById(blockHostId);
    if (!container) return;
    const q = blockSearch.trim().toLowerCase();

    // We let Grapes render every block normally (its default render after
    // `editor.on('load')`), then hide categories / blocks that don't match
    // the active tab and search. `BlockManager.render(filtered)` in 0.22
    // is unreliable when called against a custom appendTo container — it
    // replaces the BlocksView in a way that can leave the panel empty.
    const apply = () => {
      const cats = container.querySelectorAll<HTMLElement>(".gjs-block-category");
      cats.forEach((catEl) => {
        const title =
          catEl.querySelector<HTMLElement>(".gjs-title, .gjs-block-category__title")?.textContent?.trim() ?? "";
        if (!blockMatchesPaletteTab(title, paletteTab)) {
          catEl.style.display = "none";
          return;
        }
        let matched = 0;
        catEl.querySelectorAll<HTMLElement>(".gjs-block").forEach((blk) => {
          const label = (
            blk.getAttribute("title") ||
            blk.querySelector(".gjs-block-label, .gjs-block__title")?.textContent ||
            ""
          ).toLowerCase();
          const ok = !q || label.includes(q) || title.toLowerCase().includes(q);
          blk.style.display = ok ? "" : "none";
          if (ok) matched++;
        });
        catEl.style.display = matched === 0 ? "none" : "";
      });
    };

    apply();
    // Grapes' initial palette render happens during the iframe `load` tick,
    // which can land just after our useEffect runs. Re-apply on the next
    // animation frame and once shortly after so the filter sticks.
    const raf = requestAnimationFrame(apply);
    const t = setTimeout(apply, 120);
    // Re-apply if Grapes re-renders the palette (e.g. when blocks are added
    // dynamically). Watch only the structural mutations to avoid loops; we
    // only mutate `style.display` which doesn't change childList.
    const obs = new MutationObserver(apply);
    obs.observe(container, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      obs.disconnect();
    };
  }, [editor, blockSearch, paletteTab, blockHostId]);

  return (
    <aside className="flex flex-col min-h-0 h-full w-[300px] shrink-0 border-r border-slate-200 bg-white">
      {/* Tabs */}
      <div className="px-4 pt-3 shrink-0 border-b border-slate-100">
        <div className="flex items-center gap-1">
          <TabButton active={paletteTab === "elements"} onClick={() => setPaletteTab("elements")}>
            Elements
          </TabButton>
          <TabButton active={paletteTab === "blocks"} onClick={() => setPaletteTab("blocks")}>
            Blocks
          </TabButton>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            value={blockSearch}
            onChange={(e) => onBlockSearchChange(e.target.value)}
            placeholder="Search elements…"
            className="h-9 pl-8 text-sm border-slate-200"
            disabled={!mounted}
          />
        </div>
      </div>

      {/* Block manager grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-3">
          <div id={blockHostId} className="gjs-blocks-canvas min-h-[160px]" />
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0 flex items-center gap-2 text-[11px] text-slate-500">
        <MousePointerClick className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="flex-1 truncate">Drag any element onto the page</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Filename pattern">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-72 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">PDF filename pattern</p>
            <Input
              className="h-9 text-xs font-mono border-slate-200"
              placeholder="invoice-{{order.number}}"
              value={filenamePattern}
              onChange={(e) => onFilenamePatternChange(e.target.value.trim())}
              disabled={filenameDisabled}
            />
            <p className="text-[10px] text-slate-500 mt-2">Used when downloading the PDF. Tokens like <code className="text-primary">{`{{order.number}}`}</code> are supported.</p>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "text-primary" : "text-slate-500 hover:text-slate-900",
      )}
    >
      {children}
      <span
        className={cn(
          "absolute left-0 right-0 -bottom-px h-0.5 transition-opacity",
          active ? "bg-primary opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}
