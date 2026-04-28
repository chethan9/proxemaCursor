import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { ALL_LOCALE_CODES, NAMESPACES } from "@/lib/i18n";

function setNested(obj: Record<string, unknown>, key: string, value: string) {
  const parts = key.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { locale, namespace } = req.query;
  if (typeof locale !== "string" || typeof namespace !== "string") {
    return res.status(400).json({ error: "Invalid params" });
  }
  if (!ALL_LOCALE_CODES.includes(locale as never)) return res.status(404).json({ error: "Unknown locale" });
  if (!NAMESPACES.includes(namespace as never)) return res.status(404).json({ error: "Unknown namespace" });

  let baseJson: Record<string, unknown> = {};
  try {
    const filePath = path.join(process.cwd(), "public", "locales", locale, `${namespace}.json`);
    const txt = await fs.readFile(filePath, "utf-8");
    baseJson = JSON.parse(txt);
  } catch {
    baseJson = {};
  }

  const { data: rows } = await supabaseAdmin
    .from("translations")
    .select("key,value")
    .eq("locale", locale)
    .eq("namespace", namespace);

  for (const r of rows || []) {
    setNested(baseJson, r.key as string, r.value as string);
  }

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res.status(200).json(baseJson);
}