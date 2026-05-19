import type { NextApiRequest, NextApiResponse } from "next";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { buildAssistantSystemPrompt } from "@/lib/assistant/system-prompt";
import {
  getAssistantOpenAIApiKey,
  getAssistantLlmKind,
  getAssistantModelId,
} from "@/lib/assistant/openai-key.server";
import { checkAssistantRateLimit } from "@/lib/assistant/rate-limit.server";
import {
  fetchAssistantCommerceDiagnostics,
  fetchAssistantCustomerCouponStats,
  fetchAssistantInventorySnapshot,
  fetchAssistantOrdersFiltered,
  fetchAssistantPeriodKpis,
  fetchAssistantProductRankings,
  fetchStoreSummaryForAssistant,
  getAssistantStorePrefsForPrompt,
  searchProductsForAssistant,
} from "@/lib/assistant/tools.server";
import type { ModelMessage } from "@ai-sdk/provider-utils";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "512kb",
    },
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_MESSAGES = 40;
const MAX_CONTENT_LEN = 8000;

type ChatBody = {
  messages?: Array<{ role?: string; content?: unknown }>;
  storeId?: unknown;
};

function parseMessages(body: ChatBody): { ok: true; messages: ModelMessage[] } | { ok: false; error: string } {
  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "messages required" };
  }
  if (raw.length > MAX_MESSAGES) {
    return { ok: false, error: "too many messages" };
  }

  const out: ModelMessage[] = [];
  for (const m of raw) {
    const role = m.role;
    const content =
      typeof m.content === "string"
        ? m.content
        : m.content != null
          ? JSON.stringify(m.content)
          : "";
    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: "invalid message role" };
    }
    if (content.length > MAX_CONTENT_LEN) {
      return { ok: false, error: "message too long" };
    }
    if (!content.trim()) {
      return { ok: false, error: "empty message" };
    }
    out.push({ role, content });
  }

  const last = out[out.length - 1];
  if (last.role !== "user") {
    return { ok: false, error: "last message must be from user" };
  }

  return { ok: true, messages: out };
}

function normalizeStoreId(body: ChatBody): string | null {
  const id = body.storeId;
  if (typeof id !== "string") return null;
  const t = id.trim();
  if (!t || !UUID_RE.test(t)) return null;
  return t;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const userId = userRes.user.id;

  const limited = await checkAssistantRateLimit(userId);
  if (limited.ok === false) {
    res.setHeader("Retry-After", String(Math.ceil(limited.retryAfterMs / 1000)));
    return res.status(429).json({ error: "Too many requests. Try again shortly." });
  }

  const parsed = parseMessages(req.body as ChatBody);
  if (parsed.ok === false) {
    return res.status(400).json({ error: parsed.error });
  }

  const requestedStoreId = normalizeStoreId(req.body as ChatBody);
  let validatedStoreId: string | null = null;

  if (requestedStoreId) {
    const gate = await assertStoreAccess(userId, requestedStoreId);
    if (gate.allowed === false) {
      return res.status(gate.status).json({ error: gate.message });
    }
    validatedStoreId = requestedStoreId;
  }

  const apiKey = await getAssistantOpenAIApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: "Assistant is not configured (missing OpenAI API key)." });
  }

  const modelId = getAssistantModelId();
  const openai = createOpenAI({ apiKey });
  const model = openai(modelId);

  const storePrefs =
    validatedStoreId != null ? await getAssistantStorePrefsForPrompt(validatedStoreId) : null;
  const system = buildAssistantSystemPrompt({
    storeId: validatedStoreId,
    storeCurrency: storePrefs?.currency ?? null,
    storeTimezone: storePrefs?.timezone ?? null,
  });

  const assistantWindowSchema = z.object({
    range: z
      .enum(["30d", "7d", "60d", "90d", "today", "yesterday", "all", "custom"])
      .optional()
      .describe("Preset window; default 30d. Use custom with fromYmd+toYmd."),
    fromYmd: z.string().optional().describe("When range is custom: start YYYY-MM-DD (store TZ)."),
    toYmd: z.string().optional().describe("When range is custom: end YYYY-MM-DD (store TZ)."),
    combineAll: z
      .boolean()
      .optional()
      .describe("Combine all order currencies via FX into store currency (dashboard combine-all mode)."),
  });

  const tools =
    validatedStoreId != null
      ? {
          getStoreSummary: tool({
            description:
              "Load dashboard-style sales and order stats for the active store (rolling window aligned with the site home dashboard). Includes top_products (with optional image URLs), top_categories (revenue and units by primary product category), and recent order snippets. Use for revenue, orders, top sellers, top-selling categories, or performance questions.",
            inputSchema: z.object({}),
            execute: async () => fetchStoreSummaryForAssistant(validatedStoreId),
          }),
          searchProducts: tool({
            description:
              "Search products in the active store catalog by product name or SKU. Each hit includes thumbnail_url when available. Use for stock or catalog questions.",
            inputSchema: z.object({
              query: z.string().min(1).max(120).describe("Search text (name or SKU fragment)."),
            }),
            execute: async ({ query }) => searchProductsForAssistant(validatedStoreId, query),
          }),
          getCommercePeriodKpis: tool({
            description:
              "Compare net revenue and completed/processing order counts for the selected period vs the immediately preceding period of equal length (dashboard-aligned net revenue). Returns delta_pct for trends.",
            inputSchema: assistantWindowSchema,
            execute: async (input) => fetchAssistantPeriodKpis(validatedStoreId, input),
          }),
          getProductRankings: tool({
            description:
              "Rank products by revenue or units sold in the selected window (line items from paid-adjacent orders). Includes thumbnail-friendly image fields mapped server-side.",
            inputSchema: assistantWindowSchema.extend({
              sort: z.enum(["revenue", "units"]).optional().describe("Sort key; default revenue."),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async (input) => fetchAssistantProductRankings(validatedStoreId, input),
          }),
          getInventorySnapshot: tool({
            description:
              "Low-stock and out-of-stock counts plus a bounded list of SKUs below threshold (manage_stock products). Use before claiming stock levels.",
            inputSchema: z.object({
              lowStockThreshold: z.number().int().min(0).max(999).optional(),
              limit: z.number().int().min(1).max(100).optional(),
            }),
            execute: async (input) => fetchAssistantInventorySnapshot(validatedStoreId, input),
          }),
          listFilteredOrders: tool({
            description:
              "List recent orders in the selected date window. Optional CSV statuses (e.g. completed,pending). Does not replace Woo admin detail.",
            inputSchema: assistantWindowSchema.extend({
              statusCsv: z
                .string()
                .max(200)
                .optional()
                .describe("Comma-separated order statuses to filter (lowercase). Omit for all in window."),
              limit: z.number().int().min(1).max(100).optional(),
            }),
            execute: async (input) => fetchAssistantOrdersFiltered(validatedStoreId, input),
          }),
          getCustomerCouponStats: tool({
            description:
              "Top customers by net revenue in the window (requires synced customer linkage) and top Woo coupon codes used on orders (from coupon_lines).",
            inputSchema: assistantWindowSchema.extend({
              customerLimit: z.number().int().min(1).max(50).optional(),
              couponLimit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async (input) => fetchAssistantCustomerCouponStats(validatedStoreId, input),
          }),
          getCommerceDiagnostics: tool({
            description:
              "Optional: frequent product pairs in orders (bounded scan) and catalog completeness counters (missing images, drafts, missing SKU). Heavier — use when asked about bundles or catalog hygiene.",
            inputSchema: assistantWindowSchema,
            execute: async (input) => fetchAssistantCommerceDiagnostics(validatedStoreId, input),
          }),
        }
      : undefined;

  try {
    const result = streamText({
      model,
      system,
      messages: parsed.messages,
      tools,
      stopWhen: stepCountIs(tools ? 18 : 1),
      toolChoice: tools ? "auto" : undefined,
    });

    result.pipeTextStreamToResponse(res, {
      headers: {
        "X-Assistant-LLM": getAssistantLlmKind(),
      },
    });
  } catch (e) {
    console.error("[assistant/chat]", e);
    return res.status(500).json({ error: "Assistant failed to respond. Try again." });
  }

  return undefined;
}
