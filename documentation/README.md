# Proxima Cursor — Help Center (Docusaurus)

End-user documentation for **Proxima Cursor**. **Source of truth for production:** **[github.com/chethan9/wiki](https://github.com/chethan9/wiki)** (push edits there; Vercel should build that repo).

This folder mirrors the same content for developers who run the app and docs together locally under `documentation/docs/`.

## Local preview

```bash
cd documentation
npm install
npm start
```

Opens the dev server (default port 3000 unless busy).

## Production build

```bash
cd documentation
npm run build
```

Static output is written to `documentation/build/`.

## Deploy on Vercel

For **production** (`wiki-pi-blue.vercel.app`), connect the **[wiki](https://github.com/chethan9/wiki)** repository with **Root Directory** `.` (not this monorepo path).

To deploy **only** this subfolder from **proxemaCursor** instead:

1. Set **Root Directory** to `documentation`.
2. **Build Command:** `npm run build` — **Output Directory:** `build` — **Install Command:** `npm install`

## Editing

Documentation lives in `documentation/docs/`. Sidebar order follows:

- File `sidebar_position` front matter
- Folder `_category_.json` `position` fields

“Edit this page” should target **`chethan9/wiki`** in production; `editUrl` in `docusaurus.config.ts` is set accordingly when syncing from the wiki repo.
