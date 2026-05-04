/**
 * Filerobot bundles @scaleflex/ui which imports Tippy CSS inside node_modules — Next.js blocks that.
 * Global Tippy styles are loaded from `pages/_app.tsx`; strip duplicate imports after npm install.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const candidates = [
  path.join(
    root,
    "node_modules/react-filerobot-image-editor/node_modules/@scaleflex/ui/core/tooltip-v2/tooltip-v2.component.js",
  ),
  path.join(root, "node_modules/@scaleflex/ui/core/tooltip-v2/tooltip-v2.component.js"),
];

for (const filePath of candidates) {
  if (!fs.existsSync(filePath)) continue;
  let src = fs.readFileSync(filePath, "utf8");
  const next = src
    .replace(/import 'tippy\.js\/dist\/tippy\.css';\r?\n/g, "")
    .replace(/import 'tippy\.js\/animations\/scale\.css';\r?\n/g, "");
  if (next !== src) {
    fs.writeFileSync(filePath, next, "utf8");
    process.stdout.write(
      `[patch-scaleflex-filerobot-tippy] Stripped tippy CSS imports from ${path.relative(root, filePath)}\n`,
    );
  }
}
