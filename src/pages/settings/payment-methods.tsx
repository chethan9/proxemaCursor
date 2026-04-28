<![CDATA[import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next"
...
props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 9201 chars.]