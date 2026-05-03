import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Identity string baked into the client bundle (`NEXT_PUBLIC_APP_BUILD_ID`) and returned by
 * `GET /api/build-info`. Must stay aligned between build-time config and serverless runtime.
 *
 * Prefer `VERCEL_DEPLOYMENT_ID` first so **every** Vercel deployment gets a new id, including
 * redeploys of the same git commit — otherwise long-lived tabs never see an update after “same SHA” redeploys.
 */
export function resolveAppBuildIdFromEnv(env, options = {}) {
  const dep = typeof env.VERCEL_DEPLOYMENT_ID === "string" ? env.VERCEL_DEPLOYMENT_ID.trim() : "";
  if (dep) return dep;

  const sha = typeof env.VERCEL_GIT_COMMIT_SHA === "string" ? env.VERCEL_GIT_COMMIT_SHA.trim() : "";
  if (sha) return sha;

  const vb = typeof env.VERCEL_BUILD_ID === "string" ? env.VERCEL_BUILD_ID.trim() : "";
  if (vb) return vb;

  if (env.NODE_ENV === "development") return "development";

  if (options.readPackageJson !== false) {
    try {
      const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
      const v = pkg.version;
      if (v != null && String(v).trim()) return String(v).trim();
    } catch {
      /* ignore */
    }
  }

  const npmv = typeof env.npm_package_version === "string" ? env.npm_package_version.trim() : "";
  return npmv || "unknown";
}
