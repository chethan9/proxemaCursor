#!/usr/bin/env node
/**
 * Fail if English JSON contains empty objects under high-risk prefixes.
 * Empty objects produce no leaf paths, so parity checks can miss missing translations.
 * Usage: node scripts/i18n/check-en-empty-branches.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const localesDir = path.join(root, "public", "locales");

/** Prefix paths (dot notation) that must not be {} in en/site.json */
const SITE_DENY_EMPTY = [
  "taxonomy.sortOptions",
  "customers.sortOptions",
  "products.sort",
  "bulkJobs.statuses",
  "attributes.orderBy",
];

function collectEmptyObjectPaths(obj, prefix = "") {
  const out = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return out;
  const keys = Object.keys(obj);
  if (keys.length === 0 && prefix) {
    out.push(prefix);
    return out;
  }
  for (const k of keys) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      if (Object.keys(v).length === 0) {
        out.push(p);
      } else {
        out.push(...collectEmptyObjectPaths(v, p));
      }
    }
  }
  return out;
}

function isDenied(pathStr) {
  return SITE_DENY_EMPTY.some((d) => pathStr === d || pathStr.startsWith(`${d}.`));
}

const sitePath = path.join(localesDir, "en", "site.json");
const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
const emptyPaths = collectEmptyObjectPaths(site);

const bad = emptyPaths.filter(isDenied);

if (bad.length) {
  console.error(`[en/site.json] empty object(s) under denylisted prefixes:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}

console.log("i18n empty-branch guard OK (en/site.json risk prefixes).");
