"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import grapesjs from "grapesjs";
import type { Component, Editor } from "grapesjs";
import { supabase } from "@/integrations/supabase/client";
import type { TemplateConfig } from "@/lib/templates/document";
import { isFullHtmlDocument, mergePrintDocument } from "@/lib/templates/document";
import { registerTemplateBlocks } from "@/lib/templates/grapes-blocks";
import { CANVAS_FRAME_CSS } from "@/components/templates/builder/templateBuilderStyles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

/** Empty canvas: dashed drop zone inside A4 page — removed when real blocks are added */
export const EMPTY_DOC_HTML = `<div id="wrapper"><div class="tmpl-page"><div class="tmpl-empty-dropzone tmpl-placeholder" data-gjs-droppable="true" data-gjs-highlightable="true" style="min-height:120px;display:flex;align-items:center;justify-content:center;border:2px dashed #c7d2fe;border-radius:12px;background:#eef2ff;color:#6366f1;font-size:13px;font-weight:500;padding:28px 20px;text-align:center">
  Drag element or block here
</div></div></div>`;

function injectCanvasFrameCss(editor: Editor) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.head) return;
  let el = doc.getElementById("tmpl-canvas-frame-style");
  if (!el) {
    el = doc.createElement("style");
    el.id = "tmpl-canvas-frame-style";
    doc.head.appendChild(el);
  }
  el.textContent = CANVAS_FRAME_CSS;
}

function isEmptyCanvasState(editor: Editor): boolean {
  const page = editor.DomComponents.getWrapper().find(".tmpl-page")[0];
  if (!page) return false;
  const kids = page.components();
  if (kids.length === 0) return true;
  if (kids.length === 1) {
    const cl = kids.at(0)?.getClasses?.() ?? [];
    const list = Array.isArray(cl) ? cl : String(cl).split(" ");
    return list.includes("tmpl-placeholder") || list.includes("tmpl-empty-dropzone");
  }
  return false;
}

function stripEmptyPlaceholders(editor: Editor) {
  editor.DomComponents.getWrapper()
    .find(".tmpl-placeholder, .tmpl-empty-dropzone")
    .forEach((c) => c.remove());
}

export function loadEditorFromDocument(editor: Editor, doc: TemplateConfig) {
  if (doc.grapesProject && typeof doc.grapesProject === "object" && Object.keys(doc.grapesProject).length > 0) {
    try {
      editor.loadProjectData(doc.grapesProject as Parameters<Editor["loadProjectData"]>[0]);
      injectCanvasFrameCss(editor);
      return;
    } catch {
      /* fall through */
    }
  }
  const html = doc.html || "";
  if (!html.trim()) {
    editor.setComponents(EMPTY_DOC_HTML);
    injectCanvasFrameCss(editor);
    return;
  }
  if (isFullHtmlDocument(html)) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const styles = [...parsed.querySelectorAll("style")].map((s) => s.textContent || "").join("\n");
    editor.setComponents(parsed.body.innerHTML);
    if (styles.trim()) editor.setStyle(styles);
  } else {
    editor.setComponents(html);
  }
  injectCanvasFrameCss(editor);
}

export function packDocument(editor: Editor, filenamePattern?: string): TemplateConfig {
  const css = editor.getCss();
  const body = editor.getHtml();
  const grapesProject = editor.getProjectData() as Record<string, unknown>;
  const merged = mergePrintDocument({ bodyHtml: body, css, title: "Document" });
  return { html: merged, css, grapesProject, filenamePattern };
}

export type BuilderCanvasProps = {
  blockHostId: string;
  initialDocument: TemplateConfig;
  onSnapshot: (doc: TemplateConfig) => void;
  onEditorReady?: (editor: Editor) => void;
  readOnly?: boolean;
  className?: string;
};

export function BuilderCanvas({
  blockHostId,
  initialDocument,
  onSnapshot,
  onEditorReady,
  readOnly,
  className,
}: BuilderCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const initialRef = useRef(initialDocument);
  initialRef.current = initialDocument;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipEmitRef = useRef(false);
  const skipPaletteMutationsRef = useRef(true);
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const [showEmptyOverlay, setShowEmptyOverlay] = useState(false);

  const emit = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || skipEmitRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const ed2 = editorRef.current;
      if (!ed2) return;
      onSnapshot(packDocument(ed2, initialRef.current.filenamePattern));
    }, 450);
  }, [onSnapshot]);

  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    const appendSel = `#${CSS.escape(blockHostId)}`;
    const editorBox = { current: null as Editor | null };
    const editor = grapesjs.init({
      container: el,
      height: "100%",
      width: "100%",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      panels: { defaults: [] },
      blockManager: { appendTo: appendSel },
      styleManager: { appendTo: "" },
      layerManager: { appendTo: "" },
      traitManager: { appendTo: "" },
      selectorManager: { appendTo: "" },
      deviceManager: {
        devices: [
          { name: "A4", width: "794px", widthMedia: "992px" },
          { name: "Tablet", width: "768px", widthMedia: "768px" },
          { name: "Mobile", width: "320px", widthMedia: "480px" },
        ],
      },
      assetManager: {
        embedAsBase64: false,
        uploadFile: async (ev: Event) => {
          const ed = editorBox.current;
          const target = ev.target as HTMLInputElement | null;
          const dt = (ev as DragEvent).dataTransfer;
          const file = dt?.files?.[0] ?? target?.files?.[0];
          if (!file || !ed) return;
          const formData = new FormData();
          formData.append("file", file);
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          const res = await fetch("/api/templates/upload-asset", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
          const j = (await res.json()) as { url?: string; error?: string };
          if (!res.ok) throw new Error(j.error || "Upload failed");
          if (!j.url) throw new Error("No URL returned");
          ed.AssetManager.add({ type: "image", src: j.url, name: file.name });
        },
      },
    });
    editorBox.current = editor;
    editorRef.current = editor;
    registerTemplateBlocks(editor);

    const refreshEmpty = () => {
      const ed = editorRef.current;
      if (ed) setShowEmptyOverlay(isEmptyCanvasState(ed));
    };

    const onStructureMut = (model: Component) => {
      if (skipPaletteMutationsRef.current) return;
      const cls = model.getClasses?.() ?? [];
      const list = Array.isArray(cls) ? cls : String(cls).split(" ");
      const isPh = list.includes("tmpl-placeholder") || list.includes("tmpl-empty-dropzone");
      if (!isPh) stripEmptyPlaceholders(editor);
      refreshEmpty();
    };

    const onLoad = () => {
      skipEmitRef.current = true;
      skipPaletteMutationsRef.current = true;
      loadEditorFromDocument(editor, initialRef.current);
      skipEmitRef.current = false;
      requestAnimationFrame(() => {
        skipPaletteMutationsRef.current = false;
        refreshEmpty();
      });
      onEditorReadyRef.current?.(editor);
    };

    editor.on("load", onLoad);
    editor.on("update", refreshEmpty);
    editor.on("component:add", onStructureMut);
    editor.on("component:remove", refreshEmpty);

    editor.on("update", emit);
    editor.on("component:add", emit);
    editor.on("component:remove", emit);
    editor.on("component:update", emit);
    editor.on("style:change", emit);

    return () => {
      editor.off("load", onLoad);
      editor.off("update", refreshEmpty);
      editor.off("component:add", onStructureMut);
      editor.off("component:remove", refreshEmpty);
      editor.off("update", emit);
      editor.off("component:add", emit);
      editor.off("component:remove", emit);
      editor.off("component:update", emit);
      editor.off("style:change", emit);
      editor.destroy();
      editorRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [emit, blockHostId]);

  const insertStarterText = () => {
    const ed = editorRef.current;
    if (!ed || readOnly) return;
    const blk = ed.BlockManager.get("elem-text");
    const content = blk?.get("content");
    if (typeof content === "string") ed.addComponents(content);
  };

  return (
    <div className={cn("gjs-template-builder relative min-h-0 h-full w-full flex flex-col bg-slate-50", className)}>
      <div
        ref={rootRef}
        className={cn(
          "flex-1 min-h-[400px] overflow-hidden bg-slate-50 relative",
          readOnly && "pointer-events-none opacity-90",
        )}
      />
      {showEmptyOverlay && !readOnly ? (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-start justify-center pt-[16%]">
          <Button
            type="button"
            size="icon"
            variant="default"
            className="pointer-events-auto h-9 w-9 rounded-full shadow-lg"
            onClick={insertStarterText}
            aria-label="Add starter text"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      {readOnly ? <div className="absolute inset-0 z-10 cursor-not-allowed rounded-lg" aria-hidden /> : null}
    </div>
  );
}
