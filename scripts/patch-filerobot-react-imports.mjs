/**
 * react-filerobot-image-editor v5.0.1 ships a few minified chunks that call `React.createElement`
 * without `import React from "react"`. Webpack's ProvidePlugin masked this; Turbopack does not,
 * causing ReferenceError: React is not defined (e.g. HistoryButtons.js).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const libRoot = path.join(root, "node_modules/react-filerobot-image-editor/lib");

const REL_FILES = [
  "components/buttons/HistoryButtons/HistoryButtons.js",
  "components/Tabs/TabsNavbar/index.js",
  "components/Tabs/TabsResponsive.js",
];

const PREFIX_MIN = 'import React from"react";';

function needsPatch(src) {
  if (/from["']react["']/.test(src) || /require\(["']react["']\)/.test(src)) return false;
  return /\bReact\s*\./.test(src) || /\bReact\s*,/.test(src);
}

function alreadyPatched(src) {
  return src.startsWith(PREFIX_MIN) || /^import\s+React\s+from\s*["']react["']/.test(src.trimStart());
}

let patched = 0;
for (const rel of REL_FILES) {
  const filePath = path.join(libRoot, rel);
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-filerobot-react-imports] skip missing ${rel}`);
    continue;
  }
  let src = fs.readFileSync(filePath, "utf8");
  if (alreadyPatched(src)) continue;
  if (!needsPatch(src)) continue;
  fs.writeFileSync(filePath, PREFIX_MIN + src, "utf8");
  patched += 1;
  process.stdout.write(`[patch-filerobot-react-imports] prepended React import → ${rel}\n`);
}

if (patched === 0) {
  process.stdout.write("[patch-filerobot-react-imports] no files changed (already patched or package missing)\n");
}
