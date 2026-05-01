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
  const leaf = parts[parts.length - 1];
  const existing = cur[leaf];
  // Avoid replacing a nested JSON object from the file with a single flat string from the DB
  // (e.g. key "myActivity" wiping `myActivity.title`, which breaks clients + i18n).
  if (
    typeof existing === "object" &&
    existing !== null &&
    !Array.isArray(existing) &&
    typeof value === "string"
  ) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        cur[leaf] = parsed as Record<string, unknown>;
        return;
      }
    } catch {
      /* not JSON — skip destructive replace */
    }
    return;
  }
  cur[leaf] = value;
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

  // Private + no-store: merged DB overrides must not linger across deploys or behind shared caches.
  res.setHeader("Cache-Control", "private, no-store, must-revalidate");
  return res.status(200).json(baseJson);
}