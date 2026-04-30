"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import grapesjs from "grapesjs";
import type { Component, Editor } from "grapesjs";
import { supabase } from "@/integrations/supabase/client";
import type { TemplateConfig } from "@/lib/templates/document";
import { isFullHtmlDocument, mergePrintDocument, type PageSettings } from "@/lib/templates/document";
import {
  expandHandlebarsForExport,
  migrateHtmlStringForEditor,
  wireHandlebarsCanvasEditing,
} from "@/lib/templates/templateHandlebarsPreview";
import { registerTemplateBlocks } from "@/lib/templates/grapes-blocks";
import { buildCanvasFrameCss } from "@/components/templates/builder/templateBuilderStyles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

/** Empty canvas: dashed drop zone inside A4 page — removed when real blocks are added */
export const EMPTY_DOC_HTML = `<div id="wrapper"><div class="tmpl-page"><div class="tmpl-empty-dropzone tmpl-placeholder" data-gjs-droppable="true" data-gjs-highlightable="true" style="min-height:120px;display:flex;align-items:center;justify-content:center;border:2px dashed #c7d2fe;border-radius:12px;background:#eef2ff;color:#6366f1;font-size:13px;font-weight:500;padding:28px 20px;text-align:center">
  Drag element or block here
</div></div></div>`;

function injectCanvasFrameCss(editor: Editor, page?: PageSettings) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.head) return;
  let el = doc.getElementById("tmpl-canvas-frame-style");
  if (!el) {
    el = doc.createElement("style");
    el.id = "tmpl-canvas-frame-style";
    doc.head.appendChild(el);
  }
  el.textContent = buildCanvasFrameCss(page);
}

function isEmptyCanvasState(editor: Editor): boolean {
  const wrapper = editor?.DomComponents?.getWrapper?.();
  if (!wrapper) return false;
  const page = wrapper.find(".tmpl-page")?.[0];
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
  const wrapper = editor?.DomComponents?.getWrapper?.();
  if (!wrapper) return;
  wrapper.find(".tmpl-placeholder, .tmpl-empty-dropzone").forEach((c) => c.remove());
}

/** Extract <body> innerHTML and concatenated <style> text from a full HTML doc. */
function splitFullHtml(html: string): { body: string; css: string } {
  try {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const css = [...parsed.querySelectorAll("style")].map((s) => s.textContent || "").join("\n");
    return { body: parsed?.body?.innerHTML ?? "", css };
  } catch {
    return { body: html, css: "" };
  }
}

/**
 * Load a TemplateConfig into the editor.
 *
 * In Grapes 0.22+ the safe path is `loadProjectData` — `setComponents` +
 * `setStyle` can hit timing bugs when invoked right after the editor's
 * 'load' event (an internal CssComposer collection is briefly undefined,
 * surfacing as the misleading "Cannot read properties of undefined
 * (reading 'add')" trace).  We always go through `loadProjectData`.
 */
export function loadEditorFromDocument(editor: Editor, doc: TemplateConfig) {
  injectCanvasFrameCss(editor, doc.page);

  const projectData = (() => {
    if (doc.grapesProject && typeof doc.grapesProject === "object" && Object.keys(doc.grapesProject).length > 0) {
      return doc.grapesProject as Record<string, unknown>;
    }
    const html = (doc.html || "").trim();
    let component = EMPTY_DOC_HTML;
    let styles = "";
    if (html) {
      if (isFullHtmlDocument(html)) {
        const split = splitFullHtml(html);
        component = split.body || EMPTY_DOC_HTML;
        styles = split.css;
      } else {
        component = html;
      }
    }
    return {
      pages: [
        {
          component,
          // Grapes accepts CSS as a string here.
          styles: styles || undefined,
        },
      ],
    };
  })();

  try {
    editor.loadProjectData(projectData as Parameters<Editor["loadProjectData"]>[0]);
  } catch (e) {
    console.error("[builder] loadProjectData failed; resetting to empty", e);
    try {
      editor.loadProjectData({
        pages: [{ component: EMPTY_DOC_HTML }],
      } as Parameters<Editor["loadProjectData"]>[0]);
    } catch {
      /* swallow — the canvas frame CSS keeps the workspace styled */
    }
  } finally {
    injectCanvasFrameCss(editor, doc.page);
  }
}

export function packDocument(
  editor: Editor,
  filenamePattern?: string,
  page?: PageSettings,
): TemplateConfig {
  const css = editor.getCss();
  const rawBody = editor.getHtml();
  const body = expandHandlebarsForExport(rawBody);
  const grapesProject = editor.getProjectData() as Record<string, unknown>;
  const merged = mergePrintDocument({ bodyHtml: body, css, title: "Document", page });
  return { html: merged, css, grapesProject, filenamePattern, page };
}

export type BuilderCanvasProps = {
  blockHostId: string;
  styleHostId: string;
  traitHostId: string;
  selectorHostId: string;
  initialDocument: TemplateConfig;
  onSnapshot: (doc: TemplateConfig) => void;
  onEditorReady?: (editor: Editor) => void;
  readOnly?: boolean;
  className?: string;
};

export function BuilderCanvas({
  blockHostId,
  styleHostId,
  traitHostId,
  selectorHostId,
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
  // Stash `onSnapshot` in a ref so `emit` keeps a stable identity even when
  // the parent passes a fresh arrow on every render. Without this the editor
  // useEffect re-runs on every parent render, destroys+re-inits GrapesJS, and
  // the canvas flickers (also produces "Cannot read properties of undefined
  // (reading 'getDocument')" when a deferred onLoad runs against a destroyed
  // editor).
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  const [showEmptyOverlay, setShowEmptyOverlay] = useState(false);

  const emit = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || skipEmitRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const ed2 = editorRef.current;
      if (!ed2) return;
      onSnapshotRef.current(
        packDocument(ed2, initialRef.current.filenamePattern, initialRef.current.page),
      );
    }, 450);
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    const blockSel = `#${CSS.escape(blockHostId)}`;
    const styleSel = `#${CSS.escape(styleHostId)}`;
    const traitSel = `#${CSS.escape(traitHostId)}`;
    const selectorSel = `#${CSS.escape(selectorHostId)}`;
    const editorBox = { current: null as Editor | null };
    const editor = grapesjs.init({
      container: el,
      height: "100%",
      width: "100%",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      panels: { defaults: [] },
      blockManager: { appendTo: blockSel },
      // Mount the right-side managers into our React-managed host divs so
      // selecting an element on the canvas drives the Styles / Properties
      // panel.
      styleManager: {
        appendTo: styleSel,
        sectors: [
          {
            name: "Layout",
            open: true,
            properties: ["display", "position", "top", "right", "bottom", "left", "float", "z-index"],
          },
          {
            name: "Size",
            open: false,
            properties: ["width", "min-width", "max-width", "height", "min-height", "max-height"],
          },
          { name: "Space", open: false, properties: ["padding", "margin"] },
          {
            name: "Typography",
            open: false,
            properties: [
              "font-family",
              "font-size",
              "font-weight",
              "letter-spacing",
              "color",
              "line-height",
              "text-align",
              "text-decoration",
              "text-transform",
              "text-shadow",
            ],
          },
          {
            name: "Background",
            open: false,
            properties: ["background-color", "background"],
          },
          {
            name: "Borders",
            open: false,
            properties: ["border-radius", "border", "box-shadow"],
          },
        ],
      },
      traitManager: { appendTo: traitSel },
      selectorManager: { appendTo: selectorSel, componentFirst: true },
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
      // Skip while we're loading — Grapes fires `update` events during init
      // and project-data load when no wrapper exists yet.
      if (!ed || skipPaletteMutationsRef.current) return;
      setShowEmptyOverlay(isEmptyCanvasState(ed));
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
      // Defer one tick so every Grapes manager has finished init before
      // we feed components/styles in (avoids race with CssComposer).
      setTimeout(() => {
        // If the editor was destroyed between `load` firing and this tick
        // (e.g. cleanup ran), bail out — calling Canvas/DomComponents on a
        // destroyed editor throws.
        if (editor !== editorRef.current) return;
        try {
          loadEditorFromDocument(editor, initialRef.current);
          const html = editor.getHtml();
          const migrated = migrateHtmlStringForEditor(html);
          if (migrated !== html) {
            skipEmitRef.current = true;
            editor.setComponents(migrated);
            skipEmitRef.current = false;
          }
          wireHandlebarsCanvasEditing(editor, { readOnly: !!readOnly });
        } catch (err) {
          console.error("[builder] load failed", err);
        } finally {
          skipEmitRef.current = false;
          requestAnimationFrame(() => {
            skipPaletteMutationsRef.current = false;
            refreshEmpty();
          });
          onEditorReadyRef.current?.(editor);
        }
      }, 0);
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
    // Intentionally only depend on `blockHostId` (stable from useId) and
    // `emit` (now has stable identity via onSnapshotRef). The other host
    // ids are also stable from useId in the shell, so re-running this
    // effect on their change is unnecessary (and would destroy/re-init
    // GrapesJS, causing the canvas to flicker).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit, blockHostId]);

  // Re-inject canvas frame CSS when page settings change (size,
  // orientation, margin, padding, background) and emit a snapshot so the
  // saved HTML's @page rule and body padding stay in sync.
  const pageKey = initialDocument.page ? JSON.stringify(initialDocument.page) : "";
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    injectCanvasFrameCss(ed, initialDocument.page);
    emit();
    // pageKey is the deep-comparison key for the page settings object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

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
