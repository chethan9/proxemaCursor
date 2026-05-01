import type { NextApiRequest, NextApiResponse } from "next";
import { getServerAppBuildId } from "@/lib/app-build-id.server";

/**
 * Uncached build id for long-lived tabs (compare to inlined NEXT_PUBLIC_APP_BUILD_ID).
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({ buildId: getServerAppBuildId() });
}
