import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated environment variables. Server-only secrets stay off `NEXT_PUBLIC_*`.
 * Set `SKIP_ENV_VALIDATION=true` only for tooling that must run without a full `.env`.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    TAP_SECRET_KEY: z.string().optional(),
    TAP_PUBLIC_KEY: z.string().optional(),
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
    POLAR_SERVER: z.enum(["sandbox", "production", "test", "live"]).optional(),
    THUM_API_KEY: z.string().optional(),
    PAYMENT_ENCRYPTION_KEY: z.string().optional(),
    AI_CREDIT_PRICE_MINOR_PER_UNIT: z.string().optional(),
    CLOUDFLARE_IMAGE_MIRROR_METRICS: z.string().optional(),
    CF_MIRROR_REPAIR_BATCH: z.string().optional(),
    CF_BACKFILL_PRODUCT_BATCH: z.string().optional(),
    CF_FORCE_SYNC_PRODUCT_LIMIT: z.string().optional(),
    CF_FORCE_SYNC_ROUNDS: z.string().optional(),
    CF_SYNC_ALL_IMAGES_MAX_MS: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    SKIP_ENV_VALIDATION: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_VERCEL_URL: z.string().optional(),
    NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES: z.string().optional(),
    NEXT_PUBLIC_THUM_API_KEY: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
    NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES: process.env.NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES,
    NEXT_PUBLIC_THUM_API_KEY: process.env.NEXT_PUBLIC_THUM_API_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.npm_lifecycle_event === "lint",
});
