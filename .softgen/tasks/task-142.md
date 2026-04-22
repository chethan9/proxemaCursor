---
title: Rich text editor list / blockquote / code rendering
status: todo
priority: medium
type: bug
tags: [products, editor, ui]
created_by: agent
created_at: 2026-04-22T15:55:00Z
position: 142
---

## Notes
Bug report Px-10. QA clicks Bullet List / Numbered List / Blockquote / Code in the description toolbar and "nothing happens".

**Investigation hypothesis (verify first):** The TipTap commands are correctly wired in `RichTextEditor.tsx` (`toggleBulletList`, `toggleOrderedList`, `toggleBlockquote`, `toggleCode`). The toolbar buttons call them and the HTML output DOES change — but the preview area uses `prose prose-sm` classes. If `@tailwindcss/typography` is not in the Tailwind plugins OR the prose reset strips list markers, users see no visual change. Also check that `list-style`, `margin-left` aren't zeroed by a global reset.

Steps: (1) inspect `tailwind.config.ts` plugins — if `@tailwindcss/typography` is missing, this is the root cause. (2) Regardless, add explicit CSS fallbacks so editor output is always visible.

## Checklist
- [ ] Verify whether `@tailwindcss/typography` is installed/registered in `tailwind.config.ts`; if missing, document and install it, OR add scoped CSS rules in `globals.css` targeting the editor container (`.ProseMirror ul { list-style: disc; padding-left: 1.5rem; }`, `ol { list-style: decimal; }`, `blockquote { border-left: 3px solid; padding-left: 1rem; font-style: italic; }`, `code { background, padding, rounded, font-mono; }`)
- [ ] Add a `ProseMirror-focused` ring + placeholder styling to match the rest of the form
- [ ] Ensure the same styles apply in both Basic (BasicEditor) and Advanced (BasicInfoTab short + long description) editors

## Acceptance
- Clicking Bullet List in the description shows visible bullets with indent
- Numbered List shows visible numbers
- Blockquote shows left border + italic
- Inline code shows mono font + background tint
- Works identically in Basic and Advanced modes
