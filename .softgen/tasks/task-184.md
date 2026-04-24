---
title: Rich text editor list & heading styles
status: done
priority: medium
type: bug
tags: [product, editor, ui]
created_by: agent
created_at: 2026-04-24
position: 184
---

## Notes
**Bug Px-10.** Numbered list, bullet list, blockquote, and H2/H3 buttons in the product description editor appear to do nothing. Verified the editor (StarterKit) applies the formatting correctly — the HTML does gain `<ul>`, `<ol>`, `<h2>`, `<blockquote>`, etc. — but the visual output is invisible because `src/styles/globals.css` has no `.richtext-content` rules and Tailwind Preflight resets list-style/padding on `ul`/`ol` and removes heading sizes.

Root cause: CSS only. Must not change the TipTap config or toolbar logic.

Affected file: `src/styles/globals.css` (add scoped styles under `.richtext-content`).

## Checklist
- [ ] Add `.richtext-content ul` with disc bullets + left padding; `.richtext-content ol` with decimal numbers + left padding
- [ ] Add `.richtext-content h2` (1.5rem, semibold, top/bottom margin) and `.richtext-content h3` (1.25rem, semibold)
- [ ] Add `.richtext-content blockquote` with left border, muted color, italic
- [ ] Add `.richtext-content p` default spacing and `.richtext-content code` inline mono styling
- [ ] Add `.richtext-content a` underlined primary color
- [ ] Verify scoping: styles must only apply inside the editor, not leak into other app surfaces
- [ ] Verify in both Add Product and Edit Product for Basic and Advanced modes

## Acceptance
- Clicking Bullet list / Numbered list / H2 / H3 / Blockquote shows visible formatting in the editor
- Saved description renders with the same formatting on reload