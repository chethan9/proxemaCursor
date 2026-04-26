import { Maily } from "@maily-to/render";
import type { JSONContent } from "@tiptap/core";
import { renderCustomNodes } from "./render-custom-nodes";

export async function renderTemplateHtml(
  document: JSONContent,
  variables: Record<string, unknown>
): Promise<string> {
  const flat = flattenVariables(variables);
  const processed = await renderCustomNodes(document, variables);
  const maily = new Maily(processed);
  maily.setVariableValues(flat);
  return await maily.render();
}

function flattenVariables(obj: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") {
    if (prefix) out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    if (prefix) out[prefix] = JSON.stringify(obj);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      flattenVariables(v, key, out);
    } else {
      out[key] = v === null || v === undefined ? "" : Array.isArray(v) ? JSON.stringify(v) : String(v);
    }
  }
  return out;
}