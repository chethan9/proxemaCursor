"use client";

import { useCallback, useId, useMemo, useState } from "react";
import type { Editor } from "grapesjs";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { PageSettings, TemplateConfig } from "@/lib/templates/document";
import type { VariableGroup } from "@/lib/templates/templateVariableGroups";
import { BuilderTopBar } from "./BuilderTopBar";
import { BuilderLeftPanel } from "./BuilderLeftPanel";
import { BuilderRightPanel } from "./BuilderRightPanel";
import { BuilderPreviewDialog } from "./BuilderPreviewPanel";
import { BuilderVariablesDialog } from "./BuilderVariablesPanel";

const BuilderCanvas = dynamic(() => import("./BuilderCanvas").then((m) => m.BuilderCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-[400px] flex items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  ),
});

export type TemplateBuilderShellProps = {
  /** Remount canvas when server version changes */
  canvasKey: string;
  document: TemplateConfig;
  onDocumentSnapshot: (doc: TemplateConfig) => void;
  readOnly: boolean;
  /** Top bar */
  name: string;
  editingName: boolean;
  onEditingNameChange: (v: boolean) => void;
  onNameChange: (name: string) => void;
  onNameCommit: () => void;
  onNameCancel: () => void;
  templateType: string;
  dirty: boolean;
  isSample: boolean;
  isDefaultForType: boolean;
  onBack: () => void;
  onSave: () => void;
  onSaveAndClose: () => void;
  savePending: boolean;
  onRefreshPreview: () => void;
  onDownloadPdf: () => void;
  pdfDisabled: boolean;
  onSetDefault: () => void;
  setDefaultPending: boolean;
  /** Preview */
  previewSrc: string;
  previewKey: number;
  onOpenPreviewInTab: () => void;
  /** Variables */
  variableGroups: VariableGroup[];
  onCopyToken: (token: string) => void;
  onFilenamePatternChange: (pattern: string | undefined) => void;
};

export function TemplateBuilderShell({
  canvasKey,
  document,
  onDocumentSnapshot,
  readOnly,
  name,
  editingName,
  onEditingNameChange,
  onNameChange,
  onNameCommit,
  onNameCancel,
  templateType,
  dirty,
  isSample,
  isDefaultForType,
  onBack,
  onSave,
  onSaveAndClose,
  savePending,
  onRefreshPreview,
  onDownloadPdf,
  pdfDisabled,
  onSetDefault,
  setDefaultPending,
  previewSrc,
  previewKey,
  onOpenPreviewInTab,
  variableGroups,
  onCopyToken,
  onFilenamePatternChange,
}: TemplateBuilderShellProps) {
  const reactId = useId().replace(/:/g, "");
  const blockHostId = useMemo(() => `gjs-bm-${reactId}`, [reactId]);
  const styleHostId = useMemo(() => `gjs-sm-${reactId}`, [reactId]);
  const traitHostId = useMemo(() => `gjs-tm-${reactId}`, [reactId]);
  const selectorHostId = useMemo(() => `gjs-sel-${reactId}`, [reactId]);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [blockSearch, setBlockSearch] = useState("");
  const [rightOpen, setRightOpen] = useState(true);

  const syncUndo = useCallback((ed: Editor | null) => {
    if (!ed) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }
    const um = ed.UndoManager;
    setCanUndo(typeof um.hasUndo === "function" ? um.hasUndo() : false);
    setCanRedo(typeof um.hasRedo === "function" ? um.hasRedo() : false);
  }, []);

  const onEditorReady = useCallback(
    (ed: Editor) => {
      setEditor(ed);
      syncUndo(ed);
      const handler = () => syncUndo(ed);
      ed.on("undo", handler);
      ed.on("redo", handler);
      ed.on("update", handler);
    },
    [syncUndo],
  );

  const handleUndo = () => {
    if (!editor || readOnly) return;
    editor.UndoManager.undo();
    syncUndo(editor);
  };

  const handleRedo = () => {
    if (!editor || readOnly) return;
    editor.UndoManager.redo();
    syncUndo(editor);
  };

  const handleOpenPreview = () => {
    onRefreshPreview();
    setPreviewOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900">
      <BuilderTopBar
        name={name}
        editingName={editingName}
        onEditingNameChange={onEditingNameChange}
        onNameChange={onNameChange}
        onNameCommit={onNameCommit}
        onNameCancel={onNameCancel}
        templateType={templateType}
        dirty={dirty}
        isSample={isSample}
        isDefaultForType={isDefaultForType}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onBack={onBack}
        onSave={onSave}
        onSaveAndClose={onSaveAndClose}
        savePending={savePending}
        onOpenPreview={handleOpenPreview}
        onOpenVariables={() => setVariablesOpen(true)}
        onDownloadPdf={onDownloadPdf}
        pdfDisabled={pdfDisabled}
        onSetDefault={onSetDefault}
        setDefaultPending={setDefaultPending}
        rightOpen={rightOpen}
        onToggleRight={() => setRightOpen((v) => !v)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <BuilderLeftPanel
          blockHostId={blockHostId}
          editor={editor}
          blockSearch={blockSearch}
          onBlockSearchChange={setBlockSearch}
          filenamePattern={document.filenamePattern ?? ""}
          onFilenamePatternChange={(v) => onFilenamePatternChange(v ? v : undefined)}
          filenameDisabled={readOnly}
        />

        <main className="flex-1 min-w-0 flex flex-col bg-slate-50">
          <BuilderCanvas
            key={canvasKey}
            blockHostId={blockHostId}
            styleHostId={styleHostId}
            traitHostId={traitHostId}
            selectorHostId={selectorHostId}
            initialDocument={document}
            onSnapshot={onDocumentSnapshot}
            onEditorReady={onEditorReady}
            readOnly={readOnly}
            className="flex-1 min-h-0"
          />
        </main>

        <BuilderRightPanel
          editor={editor}
          styleHostId={styleHostId}
          traitHostId={traitHostId}
          selectorHostId={selectorHostId}
          page={document.page}
          onPageChange={(next: PageSettings) =>
            onDocumentSnapshot({ ...document, page: next })
          }
          pageDisabled={readOnly}
          open={rightOpen}
        />
      </div>

      <BuilderPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewSrc={previewSrc}
        previewKey={previewKey}
        onRefresh={onRefreshPreview}
        onOpenInTab={onOpenPreviewInTab}
      />

      <BuilderVariablesDialog
        open={variablesOpen}
        onOpenChange={setVariablesOpen}
        groups={variableGroups}
        onCopyToken={(t) => {
          onCopyToken(t);
        }}
      />
    </div>
  );
}
