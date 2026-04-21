import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const header = `-- WOO SYNC PRODUCTION SCHEMA
-- Idempotent: safe to run on empty or partial databases.
-- Run this ONCE in your new production Supabase SQL editor.

-- ============================================================
-- STEP 0: Base profiles table (Softgen template baseline)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 1: All project migrations (in order)
-- ============================================================

`;

let body = "";
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf8");
  body += `\n-- ${file}\n${content}\n`;
}

fs.writeFileSync("supabase/prod_schema.sql", header + body);
console.log(`Wrote supabase/prod_schema.sql with ${files.length} migrations`);