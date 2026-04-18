#!/usr/bin/env node
/**
 * Supabase migration runner.
 *
 * Applies all SQL files in supabase/migrations/ in filename order to the target database.
 * Idempotent: tracks applied migrations in schema_migrations table, skips already-applied.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres" node scripts/migrate.mjs
 *
 * Get DATABASE_URL from: Supabase dashboard → Project Settings → Database → Connection string (URI)
 * Use the "Session mode" pooler URL on port 5432 for migrations.
 *
 * Fails fast on any error — no partial state.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "supabase", "migrations");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL env var required");
  console.error("Example: DATABASE_URL=\"postgresql://postgres:...@host:5432/postgres\" node scripts/migrate.mjs");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("Connecting to database...");
  await client.connect();

  console.log("Ensuring schema_migrations table exists...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows: appliedRows } = await client.query("SELECT filename FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files, ${applied.size} already applied.`);

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      skippedCount++;
      continue;
    }
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf-8").trim();
    if (!sql) {
      console.log(`  ⊘ ${file} (empty, marking applied)`);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      continue;
    }
    console.log(`  → ${file}`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      appliedCount++;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`\nFAILED at ${file}:`);
      console.error(err.message);
      process.exit(2);
    }
  }

  console.log(`\n✓ Done. Applied ${appliedCount} new, skipped ${skippedCount} existing.`);
  await client.end();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await client.end().catch(() => {});
  process.exit(1);
});