#!/usr/bin/env node
/**
 * Full DB dump (schema + data) from Supabase dev → single SQL file.
 * Usage: node scripts/dump-full.mjs
 * Writes: supabase/prod_full_dump.sql
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-loaded from .env.local)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env.local manually
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const SCHEMA_FILE = path.join(ROOT, "supabase", "prod_schema.sql");
const OUT_FILE = path.join(ROOT, "supabase", "prod_full_dump.sql");

function quote(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${v.toISOString()}'::timestamptz`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function listTables() {
  const { data, error } = await sb.rpc("exec_sql_dump_list").maybeSingle();
  if (!error && data?.tables) return data.tables;
  // Fallback: query information_schema via a SELECT — we can use a simple workaround
  // by querying each known table via probing. But better: use PostgREST introspection.
  // Since we can't run arbitrary SQL via supabase-js easily, use the OpenAPI spec.
  const res = await fetch(`${URL_}/rest/v1/?apikey=${KEY}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const spec = await res.json();
  return Object.keys(spec.definitions || {}).filter((t) => !t.startsWith("rpc_"));
}

async function dumpTable(table) {
  const { data, error } = await sb.from(table).select("*");
  if (error) { console.warn(`  skip ${table}: ${error.message}`); return ""; }
  if (!data || data.length === 0) return `-- ${table}: 0 rows\n`;
  const cols = Object.keys(data[0]);
  const colsQ = cols.map((c) => `"${c}"`).join(", ");
  let sql = `-- ${table}: ${data.length} rows\n`;
  for (const row of data) {
    const vals = cols.map((c) => quote(row[c])).join(", ");
    sql += `INSERT INTO "public"."${table}" (${colsQ}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
  }
  return sql + "\n";
}

async function main() {
  console.log("Reading schema file...");
  const schema = fs.readFileSync(SCHEMA_FILE, "utf8");

  console.log("Discovering tables...");
  const tables = await listTables();
  console.log(`Found ${tables.length} tables:`, tables.join(", "));

  console.log("Dumping data...");
  let dataSql = "\n-- =============== DATA ===============\n\n";
  dataSql += "SET session_replication_role = replica;\n\n";
  for (const t of tables) {
    console.log(`  ${t}`);
    dataSql += await dumpTable(t);
  }
  dataSql += "SET session_replication_role = DEFAULT;\n";

  console.log("Writing file...");
  fs.writeFileSync(OUT_FILE, schema + dataSql);
  const size = fs.statSync(OUT_FILE).size;
  console.log(`Wrote ${OUT_FILE} (${(size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });