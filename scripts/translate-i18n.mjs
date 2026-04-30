#!/usr/bin/env node
/**
 * LLM-driven i18n translation pipeline for Proxima Cursor.
 *
 * Reads canonical English strings from public/locales/en/*.json, calls an LLM
 * to translate them into target locales, and upserts the results into the
 * Supabase `translations` table with `needs_review = true`.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/translate-i18n.mjs                # all default locales
 *   node scripts/translate-i18n.mjs --locales fr,de
 *   node scripts/translate-i18n.mjs --namespaces common,auth
 *   node scripts/translate-i18n.mjs --force        # re-translate even if row exists
 *   node scripts/translate-i18n.mjs --dry-run      # plan only, no API or DB writes
 *
 * Env:
 *   OPENAI_API_KEY                — required for live translation (skipped on --dry-run)
 *   OPENAI_MODEL                  — default "gpt-4o-mini"
 *   OPENAI_BASE_URL               — default "https://api.openai.com/v1"
 *   SUPABASE_URL                  — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key (server-only, bypasses RLS)
 *   I18N_BATCH_SIZE               — default 30 keys per LLM call
 *
 * Flags:
 *   --locales <csv>     restrict to comma-separated locale codes
 *   --namespaces <csv>  restrict to comma-separated namespaces
 *   --force             overwrite existing translations regardless of `needs_review`
 *   --dry-run           skip OpenAI + Supabase writes; print plan
 *   --batch-size <n>    override I18N_BATCH_SIZE
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EN_DIR = path.join(ROOT, "public", "locales", "en");

const DEFAULT_LOCALES = ["es", "fr", "de", "pt", "hi", "zh", "ja", "ru"];
const DEFAULT_NAMESPACES = ["common", "auth", "site", "pricing", "billing", "admin", "settings", "referrals"];

const LOCALE_INSTRUCTIONS = {
  es: "Spanish (es) — neutral, formal-but-friendly tone.",
  fr: "French (fr) — formal, polite (use vous).",
  de: "German (de) — formal Sie form.",
  pt: "Portuguese (pt) — neutral European Portuguese, fall back to Brazilian if needed.",
  hi: "Hindi (hi) — Devanagari script, conversational.",
  zh: "Simplified Chinese (zh-CN) — concise.",
  ja: "Japanese (ja) — polite (です/ます).",
  ru: "Russian (ru) — neutral, formal-friendly.",
  ar: "Modern Standard Arabic (ar) — formal but warm.",
};

function parseArgs(argv) {
  const args = { locales: null, namespaces: null, force: false, dryRun: false, batchSize: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--locales") args.locales = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--namespaces") args.namespaces = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--batch-size") args.batchSize = Number(argv[++i]);
  }
  return args;
}

function flattenObject(obj, prefix = "", out = {}) {
  if (obj == null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flattenObject(v, key, out);
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildPrompt(localeCode, namespace, entries) {
  const desc = LOCALE_INSTRUCTIONS[localeCode] || `target locale: ${localeCode}`;
  const sample = JSON.stringify(Object.fromEntries(entries), null, 2);
  return [
    {
      role: "system",
      content:
        "You are a professional UI translator for a SaaS product called Proxima Cursor. " +
        "Translate the JSON values from English into the requested locale. " +
        "Critical rules:\n" +
        "1. PRESERVE every `{{placeholder}}` token EXACTLY (same casing, same braces, no translation).\n" +
        "2. PRESERVE inline HTML tags such as <strong>, <code>, <a>, <em>.\n" +
        "3. KEEP the JSON structure: same keys, same number of entries.\n" +
        "4. DO NOT include explanations, only return the JSON object.\n" +
        "5. Brand placeholder `{{brand}}` is the literal product name — keep as `{{brand}}`.\n" +
        "6. Keep keys in English; translate only values.\n" +
        "7. Plural keys (`*_one`, `*_other`, `*_zero`, `*_few`, `*_many`) follow CLDR rules; translate accordingly.\n" +
        "8. Keep punctuation locale-appropriate.\n",
    },
    {
      role: "user",
      content:
        `Target locale: ${desc}\n` +
        `Namespace: ${namespace}\n\n` +
        `Translate this JSON object's values to ${localeCode}. Reply with ONLY the JSON object (no markdown fences):\n` +
        sample,
    },
  ];
}

async function callOpenAI({ apiKey, baseUrl, model, messages }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse LLM JSON: ${err.message}\nRaw: ${content.slice(0, 800)}`);
  }
}

async function fetchExistingTranslationKeys({ supabaseUrl, serviceKey, locale, namespace }) {
  const url = `${supabaseUrl}/rest/v1/translations?select=key&locale=eq.${encodeURIComponent(locale)}&namespace=eq.${encodeURIComponent(namespace)}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return new Set(rows.map((r) => r.key));
}

async function upsertBatch({ supabaseUrl, serviceKey, rows }) {
  if (rows.length === 0) return;
  const url = `${supabaseUrl}/rest/v1/translations?on_conflict=locale,namespace,key`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`);
  }
}

async function readEnglishNamespace(namespace) {
  const file = path.join(EN_DIR, `${namespace}.json`);
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    console.warn(`  [!] missing ${file} — skipping namespace ${namespace}`);
    return null;
  }
  try {
    const obj = JSON.parse(raw);
    return flattenObject(obj);
  } catch (err) {
    console.warn(`  [!] invalid JSON in ${file}: ${err.message}`);
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const locales = (args.locales && args.locales.length > 0) ? args.locales : DEFAULT_LOCALES;
  const namespaces = (args.namespaces && args.namespaces.length > 0) ? args.namespaces : DEFAULT_NAMESPACES;
  const batchSize = Math.max(1, args.batchSize ?? (Number(process.env.I18N_BATCH_SIZE) || 30));

  const apiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

  if (!args.dryRun) {
    if (!apiKey) {
      console.error("ERROR: OPENAI_API_KEY not set. Use --dry-run to preview without API calls.");
      process.exit(1);
    }
    if (!supabaseUrl || !serviceKey) {
      console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required.");
      process.exit(1);
    }
  }

  console.log(`Target locales: ${locales.join(", ")}`);
  console.log(`Target namespaces: ${namespaces.join(", ")}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Force overwrite existing: ${args.force}`);
  console.log(`Model: ${model}`);
  console.log("");

  const summary = {
    locales: {},
    started_at: new Date().toISOString(),
    finished_at: null,
    model,
    dry_run: args.dryRun,
  };

  const enByNs = new Map();
  for (const ns of namespaces) {
    const flat = await readEnglishNamespace(ns);
    if (flat) enByNs.set(ns, flat);
  }

  for (const locale of locales) {
    const localeStat = { translated: 0, skipped: 0, errors: 0, batches: 0 };
    summary.locales[locale] = localeStat;
    console.log(`\n→ Locale ${locale}`);
    for (const ns of namespaces) {
      const enFlat = enByNs.get(ns);
      if (!enFlat) continue;
      const allKeys = Object.keys(enFlat);
      if (allKeys.length === 0) continue;

      let existing = new Set();
      if (!args.dryRun && !args.force) {
        try {
          existing = await fetchExistingTranslationKeys({ supabaseUrl, serviceKey, locale, namespace: ns });
        } catch (err) {
          console.error(`  [${ns}] failed to fetch existing translations: ${err.message}`);
          localeStat.errors++;
          continue;
        }
      }
      const targetKeys = args.force ? allKeys : allKeys.filter((k) => !existing.has(k));
      if (targetKeys.length === 0) {
        console.log(`  [${ns}] up-to-date (${allKeys.length} keys, 0 needed)`);
        continue;
      }
      console.log(`  [${ns}] ${targetKeys.length}/${allKeys.length} keys need translation`);

      const batches = chunk(targetKeys, batchSize);
      for (let bi = 0; bi < batches.length; bi++) {
        const batchKeys = batches[bi];
        const entries = batchKeys.map((k) => [k, enFlat[k]]);
        if (args.dryRun) {
          console.log(`    batch ${bi + 1}/${batches.length} (${batchKeys.length} keys) — dry run`);
          localeStat.batches++;
          localeStat.translated += batchKeys.length;
          continue;
        }
        try {
          const messages = buildPrompt(locale, ns, entries);
          const result = await callOpenAI({ apiKey, baseUrl, model, messages });
          const rows = [];
          for (const k of batchKeys) {
            const v = result[k];
            if (typeof v !== "string") {
              localeStat.skipped++;
              continue;
            }
            rows.push({
              locale,
              namespace: ns,
              key: k,
              value: v,
              needs_review: true,
            });
          }
          await upsertBatch({ supabaseUrl, serviceKey, rows });
          localeStat.translated += rows.length;
          localeStat.batches++;
          console.log(`    batch ${bi + 1}/${batches.length} ✓ ${rows.length} rows upserted`);
        } catch (err) {
          console.error(`    batch ${bi + 1}/${batches.length} ✗ ${err.message}`);
          localeStat.errors++;
        }
      }
    }
    console.log(`  → ${locale} done: ${localeStat.translated} translated, ${localeStat.skipped} skipped, ${localeStat.errors} errors`);
  }

  summary.finished_at = new Date().toISOString();
  const stamp = summary.finished_at.replace(/[:.]/g, "-");
  const reportPath = path.join(ROOT, `_translation_run_${stamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary written to ${reportPath}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
