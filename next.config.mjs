/** @type {import('next').NextConfig} */
import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bundleAnalyzer from "@next/bundle-analyzer";
import nextI18NextConfig from "./next-i18next.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Inlined into the client bundle so tabs can detect new deploys without a manual hard refresh. */
function getAppBuildIdForConfig() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha) return sha;
  const dep = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  if (dep) return dep;
  if (process.env.NODE_ENV === "development") return "development";
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
    return String(pkg.version || "0.0.0");
  } catch {
    return "unknown";
  }
}

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

// Check if element-tagger is available
function isElementTaggerAvailable() {
  try {
    const require = createRequire(import.meta.url);
    require.resolve("@softgenai/element-tagger");
    return true;
  } catch {
    return false;
  }
}

// Build turbo rules only if tagger is available
function getTurboRules() {
  if (!isElementTaggerAvailable()) {
    console.log(
      "[Softgen] Element tagger not found, skipping loader configuration"
    );
    return {};
  }

  return {
    "*.tsx": ["@softgenai/element-tagger"],
    "*.jsx": ["@softgenai/element-tagger"],
  };
}

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: getAppBuildIdForConfig(),
  },
  i18n: nextI18NextConfig.i18n,
  experimental: {
    turbo: {
      rules: getTurboRules(),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  allowedDevOrigins: ["*.daytona.work", "*.softgen.dev"],
};

export default withBundleAnalyzer(nextConfig);
