import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integr
...
led", canceled_at: nowIso }).eq("id", r.id);
    s.abandoned++;
  }

  return res.status(200).json(s);
}

[Tool result trimmed: kept first 100 chars and last 100 chars of 2368 chars.]