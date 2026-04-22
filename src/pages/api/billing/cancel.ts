import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/
...
n res.status(200).json({ success: true, canceled_at_period_end: !uncancel });
}