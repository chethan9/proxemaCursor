/**
 * Visual design mode for PDF templates: the canvas shows friendly dummy text
 * while the real Handlebars source is preserved in `data-tmpl-hb`. On export
 * (`expandHandlebarsForExport`) those attributes are expanded back into live
 * template markup for Puppeteer / Handlebars rendering.
 */

import type { Editor } from "grapesjs";

export const HB_ATTR = "data-tmpl-hb";
export const PREVIEW_ATTR = "data-tmpl-preview";
export const EDIT_ATTR = "data-tmpl-edit";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "SVG",
  "TEMPLATE",
  "TEXTAREA",
  "PRE",
  "CODE",
]);

/** Structural tags — if present as element children, we recurse instead of wrapping the whole block */
const STRUCTURAL = new Set([
  "DIV",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "UL",
  "OL",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "NAV",
  "FORM",
  "FIELDSET",
]);

/** Inline / phrase tags allowed inside a migrated leaf together with {{ }} */
const INLINE_OK = new Set([
  "SPAN",
  "STRONG",
  "EM",
  "B",
  "I",
  "U",
  "A",
  "SMALL",
  "SUB",
  "SUP",
  "BR",
  "WBR",
  "MARK",
  "CODE",
]);

const SAMPLE_MAP: Record<string, string> = {
  "store.name": "Acme Studio",
  "store.logo": "Logo",
  "store.email": "hello@example.com",
  "store.phone": "+1 (415) 555-0142",
  "store.url": "www.example.com",
  "store.website": "www.example.com",
  "order.number": "#INV-2026-1042",
  "order.date": "Apr 30, 2026",
  "order.date_iso": "2026-04-30",
  "order.status": "Paid",
  "order.currency": "USD",
  "order.notes": "Please leave at front door.",
  "billing.name": "Sarah Johnson",
  "shipping.name": "Sarah Johnson",
  "customer.name": "Sarah Johnson",
  "customer.full_name": "Sarah Johnson",
  "payment.title": "Visa •• 4242",
  "payment.status": "Paid",
  "payment.transaction_id": "txn_abc123",
  "shipping_method.tracking_number": "777612345678",
  "meta.printed_at": "Apr 30, 2026",
};

export function dummyFromHandlebars(html: string): string {
  let s = html;
  s = s.replace(/\{\{#each\s+([^}]+)\}\}[\s\S]*?\{\{\/each\}\}/gi, "[ … items …]");
  s = s.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/gi, (_, _cond, inner) => {
    const parts = inner.split(/\{\{else\}\}/i);
    const main = parts[0] ?? "";
    const branch = dummyFromHandlebars(main.trim());
    return branch || "[ … ]";
  });
  s = s.replace(/\{\{else\}\}/gi, " · ");
  s = s.replace(/\{\{([^#\/][^}]*)\}\}/g, (_, expr) => placeholderForExpr(String(expr).trim()));
  return s.replace(/\s+/g, " ").trim();
}

function placeholderForExpr(expr: string): string {
  if (!expr) return "…";
  const lower = expr.toLowerCase();
  if (lower.includes("uppercase") || lower.includes("lowercase") || lower.includes("capitalize"))
    return "STATUS";
  if (lower.includes("currency")) return "$0.00";
  if (lower.includes("date")) return "Apr 30, 2026";
  if (lower.includes("barcode") || lower.includes("qr")) return "█▀▄…";
  if (lower.includes("default")) return "—";
  const path = expr.replace(/\s+/g, "").split(/\s+/)[0] ?? expr;
  const clean = path.replace(/^this\.|\.\.\//g, "");
  if (SAMPLE_MAP[clean]) return SAMPLE_MAP[clean];
  const leaf = clean.split(".").pop() ?? clean;
  return prettifyToken(leaf);
}

function prettifyToken(leaf: string): string {
  const s = leaf.replace(/_/g, " ").replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasStructuralChild(el: HTMLElement): boolean {
  for (const c of el.children) {
    if (STRUCTURAL.has(c.tagName)) return true;
  }
  return false;
}

function onlyInlineChildren(el: HTMLElement): boolean {
  for (const c of el.children) {
    if (!INLINE_OK.has(c.tagName)) return false;
  }
  return true;
}

function tryMigrateLeaf(el: HTMLElement): boolean {
  if (SKIP_TAGS.has(el.tagName)) return false;
  if (el.hasAttribute(HB_ATTR)) return false;
  const html = el.innerHTML;
  if (!html.includes("{{")) return false;
  if (hasStructuralChild(el)) return false;
  if (!onlyInlineChildren(el) && el.children.length > 0) return false;

  const encoded = encodeURIComponent(html);
  el.setAttribute(HB_ATTR, encoded);
  const preview = dummyFromHandlebars(html);
  el.setAttribute(PREVIEW_ATTR, preview);
  el.innerHTML = escapeHtmlText(preview);
  return true;
}

/** Post-order walk: migrate deepest nodes first so parents with nested spans still work */
export function migrateHandlebarsInFragment(root: HTMLElement): number {
  let n = 0;
  const postOrder = (el: HTMLElement) => {
    for (const c of Array.from(el.children)) postOrder(c as HTMLElement);
    if (tryMigrateLeaf(el)) n++;
  };
  postOrder(root);
  return n;
}

/**
 * Migrate loaded template HTML so Handlebars becomes preview text + stored source.
 * Operates on a wrapper containing the Grapes body markup (usually `#wrapper > .tmpl-page`).
 */
export function migrateHtmlStringForEditor(html: string): string {
  if (!html.includes("{{")) return html;
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  const page = wrap.querySelector(".tmpl-page") ?? wrap;
  migrateHandlebarsInFragment(page as HTMLElement);
  return wrap.innerHTML;
}

/**
 * Reverse migration for PDF / saved HTML: restore inner markup from `data-tmpl-hb`
 * and strip editor-only attributes.
 */
export function expandHandlebarsForExport(bodyHtml: string): string {
  if (!bodyHtml.includes(HB_ATTR)) return bodyHtml;
  const wrap = document.createElement("div");
  wrap.innerHTML = bodyHtml.trim();
  const root = wrap;
  root.querySelectorAll(`[${HB_ATTR}]`).forEach((node) => {
    const el = node as HTMLElement;
    const raw = el.getAttribute(HB_ATTR);
    if (!raw) return;
    try {
      el.innerHTML = decodeURIComponent(raw);
    } catch {
      el.textContent = raw;
    }
    el.removeAttribute(HB_ATTR);
    el.removeAttribute(PREVIEW_ATTR);
    el.removeAttribute(EDIT_ATTR);
  });
  return wrap.innerHTML;
}

export function wireHandlebarsCanvasEditing(editor: Editor, opts: { readOnly?: boolean }) {
  const { readOnly } = opts;

  const attach = (doc: Document) => {
    if (doc.documentElement.getAttribute("data-tmpl-hb-edit-wired")) return;
    doc.documentElement.setAttribute("data-tmpl-hb-edit-wired", "1");

    const finishEdit = (el: HTMLElement) => {
      const raw = el.innerText.replace(/\u00a0/g, " ").trim();
      el.contentEditable = "false";
      el.removeAttribute(EDIT_ATTR);
      try {
        el.setAttribute(HB_ATTR, encodeURIComponent(raw));
      } catch {
        el.setAttribute(HB_ATTR, raw);
      }
      const preview = dummyFromHandlebars(raw);
      el.setAttribute(PREVIEW_ATTR, preview);
      el.innerHTML = escapeHtmlText(preview);
      const cmp = editor.getSelected();
      if (cmp) editor.trigger("component:update", cmp);
    };

    doc.body.addEventListener(
      "dblclick",
      (e) => {
        if (readOnly) return;
        const target = (e.target as HTMLElement).closest(`[${HB_ATTR}]`) as HTMLElement | null;
        if (!target || target.closest(".gjs-toolbar")) return;
        e.preventDefault();
        e.stopPropagation();
        if (target.getAttribute(EDIT_ATTR) === "1") return;
        target.setAttribute(EDIT_ATTR, "1");
        let raw = "";
        try {
          raw = decodeURIComponent(target.getAttribute(HB_ATTR) || "");
        } catch {
          raw = target.getAttribute(HB_ATTR) || "";
        }
        target.textContent = raw;
        target.contentEditable = "true";
        target.focus();

        const onKey = (ke: KeyboardEvent) => {
          if (ke.key === "Escape") {
            ke.preventDefault();
            cleanup();
            finishEdit(target);
          }
        };
        const cleanup = () => {
          target.removeEventListener("blur", onBlur);
          target.removeEventListener("keydown", onKey);
        };
        const onBlur = () => {
          cleanup();
          finishEdit(target);
        };
        target.addEventListener("keydown", onKey);
        target.addEventListener("blur", onBlur);
      },
      true,
    );

    doc.querySelectorAll(`[${HB_ATTR}]`).forEach((el) => {
      (el as HTMLElement).title = "Double-click to edit Handlebars template";
    });
  };

  const doc = editor.Canvas.getDocument();
  if (doc) attach(doc);

  editor.on("canvas:frame:load", () => {
    const d = editor.Canvas.getDocument();
    if (d) attach(d);
  });
}
