import { resolveAppBuildIdFromEnv } from "../../resolve-app-build-id.mjs";

/**
 * Runtime server build id — uses the same resolver as `NEXT_PUBLIC_APP_BUILD_ID` (see `resolve-app-build-id.mjs`).
 */

export function getServerAppBuildId(): string {
  return resolveAppBuildIdFromEnv(process.env);
}
