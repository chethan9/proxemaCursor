import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase
...
on" : "subscription.cancel_scheduled",
    metadata: { subscription_id: subscriptionId, uncancel: !!uncancel },
  });

  return res.status(200).json({ ok: true, cancel_at_period_end: !uncancel });
}


[Tool result trimmed: kept first 100 chars and last 100 chars of 1797 chars.]