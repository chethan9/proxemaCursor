"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Braces,
  ChevronDown,
  Eye,
  FileDown,
  Loader2,
  Pencil,
  Redo2,
  Save,
  Star,
  Undo2,
} from "lucide-react";

export type BuilderTopBarProps = {
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
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onBack: () => void;
  onSave: () => void;
  onSaveAndClose: () => void;
  savePending: boolean;
  onOpenPreview: () => void;
  onOpenVariables: () => void;
  onDownloadPdf: () => void;
  pdfDisabled: boolean;
  onSetDefault: () => void;
  setDefaultPending: boolean;
};

const TYPE_TITLE: Record<string, string> = {
  invoice: "Invoice Builder",
  pickslip: "Pick Slip Builder",
  report: "Report Builder",
};

export function BuilderTopBar({
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onBack,
  onSave,
  onSaveAndClose,
  savePending,
  onOpenPreview,
  onOpenVariables,
  onDownloadPdf,
  pdfDisabled,
  onSetDefault,
  setDefaultPending,
}: BuilderTopBarProps) {
  const title = TYPE_TITLE[templateType] ?? "Template Builder";

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-3 sm:px-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-slate-600" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-slate-900 truncate hidden md:inline">{title}</span>
        <Badge variant="outline" className="text-[10px] capitalize border-slate-200 bg-slate-50 text-slate-600 shrink-0 hidden md:inline-flex">
          {dirty ? "Draft" : isSample ? "Sample" : "Saved"}
        </Badge>
      </div>

      {/* Center — editable template name */}
      <div className="flex items-center justify-center min-w-0">
        {editingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => onNameCommit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") onNameCommit();
              if (e.key === "Escape") onNameCancel();
            }}
            className="h-8 w-48 sm:w-72 text-center text-sm border-slate-200"
          />
        ) : (
          <button
            type="button"
            className="flex items-center gap-1.5 group min-w-0 px-2 py-1 rounded-md hover:bg-slate-50"
            onClick={() => !isSample && onEditingNameChange(true)}
            disabled={isSample}
            aria-label="Rename template"
          >
            <span className="text-sm font-medium text-slate-900 truncate max-w-[12rem] sm:max-w-sm">{name || "Untitled Template"}</span>
            {!isSample && <Pencil className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />}
          </button>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center justify-end gap-1.5">
        <div className="hidden sm:flex items-center mr-1 rounded-md border border-slate-200">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-none text-slate-600 disabled:opacity-40" onClick={onUndo} disabled={!canUndo || isSample} aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <span className="w-px h-5 bg-slate-200" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-none text-slate-600 disabled:opacity-40" onClick={onRedo} disabled={!canRedo || isSample} aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Button type="button" variant="outline" size="sm" className="h-9 border-slate-200 text-xs gap-1.5 hidden sm:inline-flex" onClick={onOpenPreview}>
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>

        <Button type="button" variant="outline" size="sm" className="h-9 border-slate-200 text-xs gap-1.5 hidden md:inline-flex" onClick={onOpenVariables}>
          <Braces className="h-3.5 w-3.5" />
          Variables
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-slate-200 text-xs gap-1.5"
          onClick={onSave}
          disabled={savePending || !dirty || isSample}
        >
          {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Template
        </Button>

        {/* Save & Close + split caret */}
        <div className="flex items-center rounded-md overflow-hidden">
          <Button
            type="button"
            size="sm"
            className="h-9 text-xs px-3.5 rounded-r-none"
            onClick={onSaveAndClose}
            disabled={savePending || isSample}
          >
            Save &amp; Close
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="h-9 px-2 rounded-l-none border-l border-white/20"
                aria-label="More actions"
                disabled={isSample}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onOpenPreview} className="sm:hidden">
                <Eye className="h-4 w-4 mr-2" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenVariables} className="md:hidden">
                <Braces className="h-4 w-4 mr-2" /> Variables
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownloadPdf} disabled={pdfDisabled}>
                <FileDown className="h-4 w-4 mr-2" /> Download PDF
              </DropdownMenuItem>
              {!isSample && (
                <DropdownMenuItem onClick={onSetDefault} disabled={isDefaultForType || setDefaultPending}>
                  <Star className={`h-4 w-4 mr-2 ${isDefaultForType ? "fill-amber-500 text-amber-500" : ""}`} />
                  {isDefaultForType ? "Default template" : "Set as default"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSave} disabled={savePending || !dirty || isSample}>
                <Save className="h-4 w-4 mr-2" /> Save (keep open)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
