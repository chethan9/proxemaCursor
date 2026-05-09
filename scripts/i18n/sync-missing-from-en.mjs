#!/usr/bin/env node
/**
 * Add keys present in en/<ns>.json but missing in other locales (values copied from en).
 * Idempotent. Run after en gains new keys so parity checks pass.
 * Usage: node scripts/i18n/sync-missing-from-en.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const localesDir = path.join(root, "public", "locales");

const NAMESPACES = ["common", "auth", "site", "pricing", "billing", "admin", "settings", "referrals"];

/** Add keys from en missing in target; recurse into objects; never overwrite existing leaves. */
function mergeMissing(enObj, targetObj) {
  const t =
    targetObj !== null && typeof targetObj === "object" && !Array.isArray(targetObj) ? { ...targetObj } : {};
  for (const [k, ev] of Object.entries(enObj)) {
    if (!(k in t)) {
      t[k] = ev;
      continue;
    }
    const tv = t[k];
    if (ev !== null && typeof ev === "object" && !Array.isArray(ev) && tv !== null && typeof tv === "object" && !Array.isArray(tv)) {
      t[k] = mergeMissing(ev, tv);
    }
  }
  return t;
}

/** Drop keys not present in en; align structure to en (fills missing branches from en). */
function alignToEnShape(enNode, locNode) {
  if (enNode === null || typeof enNode !== "object" || Array.isArray(enNode)) {
    return locNode;
  }
  if (locNode === null || typeof locNode !== "object" || Array.isArray(locNode)) {
    return enNode;
  }
  const o = {};
  for (const k of Object.keys(enNode)) {
    o[k] = alignToEnShape(enNode[k], k in locNode ? locNode[k] : enNode[k]);
  }
  return o;
}

const locales = fs
  .readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => n !== "en")
  .sort();

let updated = 0;

for (const ns of NAMESPACES) {
  const enPath = path.join(localesDir, "en", `${ns}.json`);
  if (!fs.existsSync(enPath)) continue;
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));

  for (const loc of locales) {
    const p = path.join(localesDir, loc, `${ns}.json`);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, JSON.stringify(en, null, 2) + "\n", "utf8");
      updated++;
      console.log(`created ${loc}/${ns}.json from en`);
      continue;
    }
    const cur = JSON.parse(fs.readFileSync(p, "utf8"));
    const merged = alignToEnShape(en, mergeMissing(en, cur));
    if (JSON.stringify(merged) !== JSON.stringify(cur)) {
      fs.writeFileSync(p, JSON.stringify(merged, null, 2) + "\n", "utf8");
      updated++;
      console.log(`updated ${loc}/${ns}.json`);
    }
  }
}

console.log(`sync-missing-from-en done (${updated} file write(s)).`);
