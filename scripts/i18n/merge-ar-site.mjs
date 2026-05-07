/**
 * Merges English structure into Arabic site.json, overlays existing Arabic,
 * then applies site-ar-overrides.json for strings that still match English.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");

function overlay(enNode, arNode) {
  if (typeof enNode !== "object" || enNode === null || Array.isArray(enNode)) {
    if (arNode !== undefined) return arNode;
    return enNode;
  }
  const result = {};
  for (const k of Object.keys(enNode)) {
    const ev = enNode[k];
    const av = arNode && typeof arNode === "object" && !Array.isArray(arNode) ? arNode[k] : undefined;
    if (typeof ev === "object" && ev !== null && !Array.isArray(ev)) {
      result[k] = overlay(ev, av !== undefined && typeof av === "object" && !Array.isArray(av) ? av : undefined);
    } else {
      result[k] = av !== undefined ? av : ev;
    }
  }
  return result;
}

function setDeep(obj, dotted, val) {
  const parts = dotted.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!o[p] || typeof o[p] !== "object") o[p] = {};
    o = o[p];
  }
  o[parts[parts.length - 1]] = val;
}

const en = JSON.parse(fs.readFileSync(path.join(root, "public/locales/en/site.json"), "utf8"));
const arOld = JSON.parse(fs.readFileSync(path.join(root, "public/locales/ar/site.json"), "utf8"));
let merged = overlay(en, arOld);

function loadOverrides() {
  const single = path.join(__dirname, "site-ar-overrides.json");
  if (fs.existsSync(single)) {
    return JSON.parse(fs.readFileSync(single, "utf8"));
  }
  const chunks = ["ar-chunk0.json", "ar-chunk1.json", "ar-chunk2.json", "ar-chunk3.json"];
  const o = {};
  for (const c of chunks) {
    const p = path.join(__dirname, c);
    if (!fs.existsSync(p)) continue;
    Object.assign(o, JSON.parse(fs.readFileSync(p, "utf8")));
  }
  return o;
}

const overrides = loadOverrides();
for (const [k, v] of Object.entries(overrides)) {
  setDeep(merged, k, v);
}

fs.writeFileSync(path.join(root, "public/locales/ar/site.json"), JSON.stringify(merged, null, 2) + "\n");
console.log("Wrote public/locales/ar/site.json");
