<![CDATA[
import { fileURLToPath } from "url";
import { dirname } from "path";
import { FlatCompat } from "@eslint/eslintrc";
...
                "@/integrations/supabase/admin",
              ],
              message:
                "supabaseAdmin is server-only. Use a *.server.ts service module called from an API route instead.",
            },
            {
              group: ["**/*.server", "**/*.server.ts", "**/*.server.tsx"],
              message:
                "Server-only module — use an API route or call from another *.server.ts module instead.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 1488 chars.]

[Tool result trimmed: kept first 100 chars and last 100 chars of 419 chars.]