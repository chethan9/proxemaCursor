#!/usr/bin/env node
/**
 * Every locale must have the same leaf key paths as English (canonical).
 * Usage: node scripts/i18n/check-all-locale-parity.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const localesDir = path.join(root, "public", "locales");

const NAMESPACES = ["common", "auth", "site", "pricing", "billing", "admin", "settings", "referrals"];

function allLeafPaths(obj, prefix = "") {
  const paths = [];
  if (obj === null || obj === undefined) return paths;
  if (typeof obj !== "object" || Array.isArray(obj)) {
    paths.push(prefix || "(root)");
    return paths;
  }
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      paths.push(...allLeafPaths(v, p));
    } else {
      paths.push(p);
    }
  }
  return paths;
}

const localeDirs = fs
  .readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => name !== "en")
  .sort();

let errors = 0;

for (const ns of NAMESPACES) {
  const enPath = path.join(localesDir, "en", `${ns}.json`);
  if (!fs.existsSync(enPath)) continue;
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  const Pe = new Set(allLeafPaths(en));

  for (const loc of localeDirs) {
    const p = path.join(localesDir, loc, `${ns}.json`);
    if (!fs.existsSync(p)) {
      console.error(`[${loc}/${ns}.json] missing file (expected same namespaces as en)`);
      errors++;
      continue;
    }
    const other = JSON.parse(fs.readFileSync(p, "utf8"));
    const Po = new Set(allLeafPaths(other));
    const missing = [...Pe].filter((x) => !Po.has(x));
    const extra = [...Po].filter((x) => !Pe.has(x));
    if (missing.length) {
      console.error(
        `[${loc}/${ns}.json] missing ${missing.length} keys vs en:\n  ${missing.slice(0, 40).join("\n  ")}${missing.length > 40 ? "\n  …" : ""}`,
      );
      errors++;
    }
    if (extra.length) {
      console.error(
        `[${loc}/${ns}.json] extra ${extra.length} keys not in en:\n  ${extra.slice(0, 40).join("\n  ")}${extra.length > 40 ? "\n  …" : ""}`,
      );
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\ni18n locale parity check failed (${errors} issue(s)).`);
  process.exit(1);
}
console.log(`i18n locale parity OK (${localeDirs.length} locales × namespaces vs en).`);
