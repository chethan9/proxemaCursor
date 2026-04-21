<![CDATA[import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integ
...
error } = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(error);
  }
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 5198 chars.]