import type { JSONContent } from "@tiptap/core";

export type TemplateType = "invoice" | "pickslip";

export interface TemplateRow {
  id: string;
  client_id: string;
  name: string;
  type: TemplateType;
  description: string | null;
  is_sample: boolean;
  is_default_for_type: boolean;
  current_version_id: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersionRow {
  id: string;
  template_id: string;
  version_number: number;
  document: JSONContent;
  styles: Record<string, unknown>;
  change_note: string | null;
  created_at: string;
}

export type TemplateDocument = JSONContent;
export type DocumentStyles = Record<string, unknown>;

export function emptyDocument(): TemplateDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Start designing your template..." }],
      },
    ],
  };
}

export function defaultStyles(): DocumentStyles {
  return {};
}