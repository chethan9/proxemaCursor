---
title: Rich text editor list / blockquote / code rendering
status: done
priority: medium
type: bug
tags: [products, editor, ui]
created_by: agent
created_at: 2026-04-22T15:55:30Z
position: 142
---

## Notes
Bug Px-10. Clicking Bullet List / Numbered List / Blockquote / Code in the description editor appears to do nothing. Toolbar wires the correct TipTap commands (`toggleBulletList`, `toggleOrderedList`, `toggleBlockquote`, `toggleCode`) — HTML is being produced but has no visible markers because `@tailwindcss/typography` is not installed, so `prose prose-sm` classes are no-ops.

Fix by removing `prose` classes and relying on explicit `.ProseMirror` CSS in `globals.css` (already present after latest commit). No new dependency.

## Checklist
- [x] Remove `prose prose-sm` from `RichTextEditor.tsx` editor container class
- [x] Keep explicit `.ProseMirror` styles in `globals.css` covering `h2`, `h3`, `ul` (disc), `ol` (decimal), `blockquote`, `code`, `strong`, `a`
- [x] Verify toolbar commands still fire correctly (wiring unchanged)

## Acceptance
- Clicking Bullet List produces a visibly bulleted list
- Clicking Numbered List produces a visibly numbered list
- Blockquote renders with a left border + muted text
- Inline code shows mono font + background tint
- Works identically in Basic and Advanced modes
