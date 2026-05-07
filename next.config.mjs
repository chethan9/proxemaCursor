/** @type {import('next').NextConfig} */
import { createRequire } from "module";
import bundleAnalyzer from "@next/bundle-analyzer";
import nextI18NextConfig from "./next-i18next.config.js";
import { resolveAppBuildIdFromEnv } from "./resolve-app-build-id.mjs";

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
  compiler: {
    styledComponents: true,
  },
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: resolveAppBuildIdFromEnv(process.env),
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
  /**
   * react-filerobot-image-editor ships some chunks that use `React.createElement` without importing
   * `react`. Webpack: ProvidePlugin injects `React` client-side. Turbopack: run postinstall
   * `scripts/patch-filerobot-react-imports.mjs` (see package.json) so those files get an explicit import.
   */
  webpack: (config, { webpack: webpackInstance, isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new webpackInstance.ProvidePlugin({
          React: "react",
        }),
      );
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
