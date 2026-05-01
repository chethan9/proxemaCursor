/**
 * Runtime server build id — keep resolution aligned with `NEXT_PUBLIC_APP_BUILD_ID` in next.config.mjs.
 */

export function getServerAppBuildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha) return sha;
  const dep = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  if (dep) return dep;
  if (process.env.NODE_ENV === "development") return "development";
  return process.env.npm_package_version?.trim() || "unknown";
}
