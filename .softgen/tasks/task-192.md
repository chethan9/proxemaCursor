---
title: Replace Tiptap with Quill 2 in RichTextEditor
status: done
priority: high
type: chore
tags: [editor, ui, product-edit]
created_by: agent
created_at: 2026-04-24T20:55:00Z
position: 192
---

## Notes

Current `src/components/product-edit/RichTextEditor.tsx` is Tiptap-based and has persistent bugs (cursor jumps, content-sync issues, HTML/visual mode desync, paste/undo quirks). Replace internals with **Quill 2.0** (MIT licensed, free, actively maintained) while keeping the component's public API identical so all call sites keep working without changes.

**Why Quill 2.0 specifically** — Quill 1.x had a notorious bug where all lists became `<ol data-list="bullet">` instead of real `<ul>`. Quill 2.0 fixes this via `editor.getSemanticHTML()` which outputs clean WooCommerce-compatible HTML (`<ul>`, `<ol>`, `<h2>`, `<strong>`, `<a>`, etc.).

**Public API to preserve (DO NOT CHANGE):**
```ts
interface Props {
  value: string;
  onChange: (html: string) => void;
  rows?: number;        // used to compute min-height
  placeholder?: string;
}
```

**Call sites (untouched):**
- `src/components/product-edit/BasicEditor.tsx` — description, rows=6
- `src/components/product-edit/tabs/BasicInfoTab.tsx` — description rows=6, short_description rows=3

**Packages:**
- Install `quill@^2.0.0` and `react-quill-new` (the maintained React 18 fork; do NOT use stale `react-quill`)
- Uninstall after migration verified: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline`

**SSR safety (Next.js page router):**
- Quill accesses `document`/`window` at init → import via `next/dynamic` with `{ ssr: false }`
- Skeleton fallback matching current loader: `h-[180px] rounded-md border border-border bg-muted/20 animate-pulse`

**HTML output quality:**
- Use `editor.getSemanticHTML()` (Quill 2.0 API) for onChange, NOT `quill.root.innerHTML` — the semantic method produces clean tags without Quill-specific markup
- Normalize empty state: strip `<p><br></p>` → `""` before firing `onChange` so WooCommerce doesn't store a useless paragraph
- Trim trailing empty paragraphs

**Toolbar config (match current feature set):**
```js
[
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean']  // remove format
]
```
Undo/redo handled by Quill natively (Cmd+Z / Ctrl+Z).

**Link handling:**
- Override Quill's link sanitizer so inserted links get `target="_blank"` + `rel="noopener noreferrer"` automatically
- Use Quill's `Link` format customization

**Paste cleanliness:**
- Quill's `clipboard` module strips most inline styles by default — keep defaults
- Add `matchers` to strip `style`, `class`, `id` attributes from pasted HTML to keep output clean for Woo

**Styling alignment with our theme:**
- Import Quill core CSS (`quill/dist/quill.snow.css`) once globally in `src/styles/globals.css`
- Override Snow theme CSS vars in `globals.css` to track our design tokens (toolbar bg uses `hsl(var(--muted))`, border uses `hsl(var(--border))`, focus ring uses `hsl(var(--ring))`, dark mode handled via `.dark` selector)
- Wrap editor in `richtext-content` class to preserve typography in preview surfaces (`LivePreviewCard`)
- Match current outer shell: `rounded-md border border-border bg-background overflow-hidden`

**Behavior requirements (fixes current bugs):**
- External `value` sync WITHOUT cursor jump: only call `quill.setContents` (via Delta) when incoming `value` differs from current `getSemanticHTML()` output AND editor is NOT focused (user typing must not be interrupted)
- `onChange` fires on `text-change` event, debounced one tick to avoid intermediate Delta states
- `placeholder` prop → passed to Quill config `placeholder` option

**Visual / HTML mode toggle:**
- Keep the existing two-tab UX (Visual / HTML)
- Visual tab = Quill editor
- HTML tab = plain `<textarea>` showing/editing raw HTML; on switching tabs, content syncs both ways (textarea → Quill via `clipboard.dangerouslyPasteHTML`, Quill → textarea via `getSemanticHTML()`)

**Acceptance-blocking bugs to verify fixed:**
- Typing no longer jumps cursor to end on each keystroke
- Switching Visual ↔ HTML preserves content exactly
- Typing in nested lists (Tab to indent) produces proper nested `<ul><li><ul><li>` in output HTML
- Pasting from Google Docs/Word keeps headings, bold, lists, links but strips inline `style=` and Google's span wrappers
- Undo/redo works via keyboard after tab switch

## Checklist

- [x] Install `quill@^2.0.0` and `react-quill-new`; uninstall Tiptap packages (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline`)
- [x] Rewrite `src/components/product-edit/RichTextEditor.tsx` using `react-quill-new` (Quill 2.0), preserving the existing `{value, onChange, rows, placeholder}` prop contract exactly
- [x] Load editor via `next/dynamic({ ssr: false })` with matching pulse skeleton fallback
- [x] Configure toolbar: headings H2/H3, bold/italic/underline/strike, ordered/bullet lists, blockquote, code block, link, clean-format
- [x] Use `editor.getSemanticHTML()` for onChange output (Quill 2.0 clean HTML API), NOT `innerHTML`
- [x] Normalize empty output: strip `<p><br></p>` / whitespace-only paragraphs → return `""`
- [x] Fix cursor-jump: only resync editor content when external `value` differs from current output AND editor is not focused
- [x] Retain Visual / HTML tab toggle; HTML tab uses a plain textarea; round-trip content cleanly on switch via `clipboard.dangerouslyPasteHTML` and `getSemanticHTML()`
- [x] Override Quill's link sanitizer so inserted links get `target="_blank"` + `rel="noopener noreferrer"`
- [x] Add clipboard matchers to strip `style`, `class`, `id` attributes from pasted HTML
- [x] Import `quill/dist/quill.snow.css` globally; override Snow CSS variables in `globals.css` to track our design tokens for light and dark mode (toolbar bg, border, text, focus ring)
- [x] Preserve `richtext-content` class wrapper so `LivePreviewCard` typography stays intact
- [x] Wire `placeholder` prop via Quill config
- [x] Smoke-test all three call sites: BasicEditor description, BasicInfoTab description, BasicInfoTab short_description — content loads, edits save, no cursor jumps, HTML output is clean semantic HTML
- [x] Confirm production bundle builds clean with no leftover Tiptap references

## Acceptance

- Typing in the product description editor no longer jumps the cursor; edits persist on save.
- HTML output uses proper semantic tags (`<ul>`, `<ol>`, `<h2>`, `<strong>`, `<a target="_blank">`) compatible with WooCommerce rendering.
- Visual ↔ HTML toggle round-trips content without loss across all three usage sites.