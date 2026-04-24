<![CDATA[import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, T
...
hrow error;
}

export interface DefaultTrialResult {
  planId: string;
  trialDays: number;
  curr
...
ult, "trialing", { plan_slug: plan.slug, trial_days: trialDays });
  return sub;
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 4937 chars.]