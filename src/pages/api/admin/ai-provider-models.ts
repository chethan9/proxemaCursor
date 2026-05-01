import type { NextApiRequest, NextApiResponse } from "next";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { listModelsForAiProvider } from "@/services/aiProviderModels.server";

const PROVIDERS = ["google_gemini", "openai_image"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  const raw = typeof req.query.provider === "string" ? req.query.provider : "";
  if (!PROVIDERS.includes(raw as (typeof PROVIDERS)[number])) {
    return res.status(400).json({ error: "Invalid provider" });
  }

  const provider = raw as "google_gemini" | "openai_image";
  const { models, error } = await listModelsForAiProvider(provider);

  return res.status(200).json({ provider, models, error });
}
