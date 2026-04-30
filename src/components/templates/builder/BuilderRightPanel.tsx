"use client";

import { useEffect, useState } from "react";
import type { Component, Editor } from "grapesjs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MousePointer2, Trash2, Copy, FileText } from "lucide-react";
import type { PageSettings } from "@/lib/templates/document";
import { BuilderPageSettings } from "./BuilderPageSettings";

export type BuilderRightPanelProps = {
  editor: Editor | null;
  styleHostId: string;
  traitHostId: string;
  selectorHostId: string;
  page?: PageSettings;
  onPageChange: (next: PageSettings) => void;
  pageDisabled?: boolean;
  /**
   * Toggle visibility. The panel and its host divs remain mounted at all
   * times so Grapes' `appendTo` selectors don't lose their containers — we
   * just hide the aside via CSS.
   */
  open: boolean;
};

type Tab = "page" | "styles" | "properties";

export function BuilderRightPanel({
  editor,
  styleHostId,
  traitHostId,
  selectorHostId,
  page,
  onPageChange,
  pageDisabled,
  open,
}: BuilderRightPanelProps) {
  const [tab, setTab] = useState<Tab>("page");
  const [selected, setSelected] = useState<Component | null>(null);

  useEffect(() => {
    if (!editor) {
      setSelected(null);
      return;
    }
    const sync = () => setSelected(editor.getSelected() ?? null);
    sync();
    editor.on("component:selected", sync);
    editor.on("component:deselected", sync);
    return () => {
      editor.off("component:selected", sync);
      editor.off("component:deselected", sync);
    };
  }, [editor]);

  // Auto-switch to Styles tab when an element is selected (so users see the
  // controls relevant to what they just clicked) — but only if they were on
  // the Page tab, never override an explicit user choice.
  useEffect(() => {
    if (selected && tab === "page") setTab("styles");
    if (!selected && (tab === "styles" || tab === "properties")) setTab("page");
    // Intentionally only react to selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const tag = (selected?.get?.("tagName") as string | undefined)?.toUpperCase();
  const type = selected?.get?.("type") as string | undefined;
  const label = tag || (type && type !== "default" ? type : "Element");

  const handleDuplicate = () => {
    if (!editor || !selected) return;
    const parent = selected.parent();
    if (!parent) return;
    const idx = parent.components().indexOf(selected);
    parent.append(selected.clone(), { at: idx + 1 });
  };

  const handleRemove = () => {
    if (!editor || !selected) return;
    selected.remove();
  };

  return (
    <aside
      className={cn(
        "gjs-template-builder gjs-right-panel flex flex-col min-h-0 h-full w-[320px] shrink-0 border-l border-slate-200 bg-white transition-[width,opacity] overflow-hidden",
        !open && "w-0 border-l-0 opacity-0 pointer-events-none",
      )}
    >
      {/* Tabs */}
      <div className="px-3 pt-2 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-0">
          <TabButton active={tab === "page"} onClick={() => setTab("page")}>
            Page
          </TabButton>
          <TabButton active={tab === "styles"} onClick={() => setTab("styles")}>
            Styles
          </TabButton>
          <TabButton active={tab === "properties"} onClick={() => setTab("properties")}>
            Properties
          </TabButton>
        </div>
      </div>

      {/* Context chip with quick actions */}
      {tab === "page" ? (
        <div className="px-4 py-2.5 shrink-0 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-600">
          <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="flex-1 truncate">
            <span className="font-semibold text-slate-900">Document</span>
            <span className="text-slate-400"> · page setup</span>
          </span>
        </div>
      ) : (
        <div className="px-4 py-2.5 shrink-0 border-b border-slate-100 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MousePointer2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            {selected ? (
              <span className="flex-1 truncate text-xs">
                <span className="font-semibold text-slate-900">{label}</span>
                <span className="text-slate-400"> selected</span>
              </span>
            ) : (
              <span className="flex-1 truncate text-xs text-slate-400">No element selected</span>
            )}
          </div>
          {selected ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleDuplicate}
                title="Duplicate"
                aria-label="Duplicate element"
                className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                title="Delete"
                aria-label="Delete element"
                className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Selector manager host — kept mounted (so Grapes' appendTo finds it)
          but visually hidden. Class management is rarely useful in PDF
          templates and adds noise. */}
      <div id={selectorHostId} className="hidden" aria-hidden="true" />

      {/* Body — manager hosts stay mounted at all times so Grapes'
          `appendTo` selectors find their containers. Tab switching is
          purely a CSS toggle (no remount, no torn-down Grapes DOM). */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-6 pt-1">
          {tab === "page" ? (
            <BuilderPageSettings page={page} onChange={onPageChange} disabled={pageDisabled} />
          ) : null}

          {tab !== "page" && !selected ? <EmptyState /> : null}

          <div
            id={styleHostId}
            className={cn(
              "gjs-style-host",
              tab !== "styles" || !selected ? "hidden" : "",
            )}
          />
          <div
            id={traitHostId}
            className={cn(
              "gjs-trait-host",
              tab !== "properties" || !selected ? "hidden" : "",
            )}
          />
          {selected && tab === "properties" ? (
            <PropertiesEmptyHint hostId={traitHostId} />
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  );
}

/**
 * Renders a hint when the trait host has no traits to show. We can't easily
 * detect "empty" from React (Grapes manages that DOM), so we use a CSS-only
 * sibling hint that surfaces when `.gjs-trt-traits` is empty.
 */
function PropertiesEmptyHint({ hostId }: { hostId: string }) {
  return (
    <div
      data-trait-empty-for={hostId}
      className="trait-empty-hint hidden text-center py-8 px-4 text-xs text-slate-500"
    >
      <p className="font-medium text-slate-700 mb-1">No properties</p>
      <p>This element has no editable attributes.</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <MousePointer2 className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-700">Nothing selected</p>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
        Click an element on the canvas to edit its styles and properties.
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex-1 px-2 py-2.5 text-[13px] font-semibold transition-colors text-center",
        active ? "text-slate-900" : "text-slate-500 hover:text-slate-700",
      )}
    >
      {children}
      <span
        className={cn(
          "absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-opacity",
          active ? "bg-primary opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}
