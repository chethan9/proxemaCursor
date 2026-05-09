# Proxima Cursor — Help Center (Docusaurus)

End-user documentation for **Proxima Cursor**, maintained alongside the app in this repo under `documentation/docs/`.

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

1. Create or select a Vercel project.
2. Set **Root Directory** to `documentation`.
3. Framework preset: **Docusaurus** (or leave automatic detection).
4. **Build Command:** `npm run build`
5. **Output Directory:** `build`
6. **Install Command:** `npm install`

Point your deployment URL (for example `wiki-pi-blue.vercel.app`) at this project. The canonical site URL is configured in `docusaurus.config.ts` (`url` / production hostname).

## Editing

Documentation lives in `documentation/docs/`. Sidebar order follows:

- File `sidebar_position` front matter
- Folder `_category_.json` `position` fields

“Edit this page” links target the `documentation/` path on GitHub when `editUrl` in `docusaurus.config.ts` matches your default branch.
