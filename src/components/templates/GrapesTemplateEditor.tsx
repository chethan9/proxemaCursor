"use client";

import { useId } from "react";
import { BuilderCanvas, type BuilderCanvasProps } from "@/components/templates/builder/BuilderCanvas";

/** @deprecated Prefer {@link TemplateBuilderShell} + {@link BuilderCanvas} with a dedicated block palette host. */
export type GrapesTemplateEditorProps = Omit<BuilderCanvasProps, "blockHostId"> & {
  blockHostId?: string;
};

/** Legacy layout: block palette stacked above the canvas. Prefer TemplateBuilderShell in product UI. */
export function GrapesTemplateEditor({ blockHostId: externalBlockHostId, className, ...props }: GrapesTemplateEditorProps) {
  const rid = useId().replace(/:/g, "");
  const blockHostId = externalBlockHostId ?? `gjs-legacy-${rid}`;
  return (
    <div className={className ?? "flex flex-col h-full min-h-0 gap-2"}>
      <div className="shrink-0 max-h-36 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
        <div id={blockHostId} className="gjs-blocks-canvas min-h-[72px]" />
      </div>
      <BuilderCanvas {...props} blockHostId={blockHostId} className="min-h-[320px] flex-1" />
    </div>
  );
}
