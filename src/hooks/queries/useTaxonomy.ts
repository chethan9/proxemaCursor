<![CDATA[import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchTags } from "@/se
...
ze);
      return { data, count };
    },
    enabled: !!storeId && enabled,
    staleTime: 60_000,
  });
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 1362 chars.]