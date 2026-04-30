"use client";

import { useEffect, useState } from "react";
import type { Component, Editor } from "grapesjs";
import { ScrollArea } from "@/components/ui/scroll-area";

export type BuilderInspectorPanelProps = {
  editor: Editor | null;
  open: boolean;
};

export function BuilderInspectorPanel({ editor, open }: BuilderInspectorPanelProps) {
  const [selected, setSelected] = useState<Component | null>(null);

  useEffect(() => {
    if (!editor || !open) {
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
  }, [editor, open]);

  if (!open) return null;

  const tag = selected?.get?.("tagName") as string | undefined;
  const type = selected?.get?.("type") as string | undefined;
  const attrs = selected?.getAttributes?.() ?? {};

  return (
    <div className="w-[220px] shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-600 shrink-0">Selection</div>
      <ScrollArea className="flex-1">
        <div className="p-3 text-xs space-y-2">
          {!selected ? (
            <p className="text-slate-500">Select an element on the canvas.</p>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-medium">Tag</div>
                <code className="text-[11px] font-mono text-slate-800">{tag || type || "—"}</code>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-medium mb-1">Attributes</div>
                <ul className="space-y-1 font-mono text-[10px] text-slate-600 break-all">
                  {Object.entries(attrs).length === 0 ? <li className="text-slate-400">None</li> : null}
                  {Object.entries(attrs).map(([k, v]) => (
                    <li key={k}>
                      <span className="text-slate-500">{k}</span>={String(v)}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
