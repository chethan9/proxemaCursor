#!/usr/bin/env node
/**
 * Fails if Arabic locale JSON is missing keys present in English (nested keys).
 * Usage: node scripts/i18n/check-ar-parity.mjs
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

let errors = 0;
for (const ns of NAMESPACES) {
  const enPath = path.join(localesDir, "en", `${ns}.json`);
  const arPath = path.join(localesDir, "ar", `${ns}.json`);
  if (!fs.existsSync(enPath)) continue;
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  const ar = fs.existsSync(arPath) ? JSON.parse(fs.readFileSync(arPath, "utf8")) : {};
  const Pe = new Set(allLeafPaths(en));
  const Pa = new Set(allLeafPaths(ar));
  const missing = [...Pe].filter((p) => !Pa.has(p));
  const extra = [...Pa].filter((p) => !Pe.has(p));
  if (missing.length) {
    console.error(`[ar/${ns}.json] missing ${missing.length} keys vs en:\n  ${missing.slice(0, 30).join("\n  ")}${missing.length > 30 ? "\n  …" : ""}`);
    errors++;
  }
  if (extra.length) {
    console.error(`[ar/${ns}.json] extra ${extra.length} keys not in en:\n  ${extra.slice(0, 30).join("\n  ")}${extra.length > 30 ? "\n  …" : ""}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\ni18n AR parity check failed (${errors} namespace issue(s)).`);
  process.exit(1);
}
console.log("i18n AR parity OK (all namespaces match en key paths).");
