import type { NextApiRequest, NextApiResponse } from "next";
import bulkWorker from "@/pages/api/cron/process-bulk-jobs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  // Bypass cron secret by injecting the expected auth header
  req.headers.authorization = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  return bulkWorker(req, res);
}