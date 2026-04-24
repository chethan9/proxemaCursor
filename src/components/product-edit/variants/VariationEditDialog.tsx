<![CDATA[import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, Dialo
...
yOpen}
            mode="multi"
            onConfirm={(items) => {
              const mapped = items.map((it) => ({ id: it.id, src: it.src, alt: it.alt }));
              onUpdate({ gallery: [...gallery, ...mapped] });
              setGalleryOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 12131 chars.]