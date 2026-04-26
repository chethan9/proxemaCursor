import { useState } from "react";
import type { TemplateDocument, DocumentStyles } from "@/lib/templates/document";
import { renderDocumentToHtml } from "@/lib/templates/render-html";
import { sampleInvoiceData } from "@/lib/templates/sample-data";
import { Monitor, Tablet, Smartphone, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const WIDTHS = { desktop: 720, tablet: 600, mobile: 400 };

export function PreviewPane({ doc, styles }: { doc: TemplateDocument; styles: DocumentStyles }) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [dark, setDark] = useState(false);
  const html = renderDocumentToHtml(doc, sampleInvoiceData, styles);

  return (
    <div className="h-full flex flex-col bg-muted/20">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-card">
        <div className="text-xs font-semibold">Preview</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-md p-0.5">
            {(["desktop", "tablet", "mobile"] as const).map((d) => {
              const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
              return (
                <button key={d} onClick={() => setDevice(d)} className={cn("h-6 w-6 rounded flex items-center justify-center transition-colors", device === d ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  <Icon className="h-3 w-3" />
                </button>
              );
            })}
          </div>
          <button onClick={() => setDark(!dark)} className="h-6 w-6 rounded flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground">
            {dark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
          </button>
        </div>
      </div>
      <div className={cn("flex-1 overflow-auto p-6", dark && "bg-slate-900")}>
        <div className="mx-auto bg-white shadow-md transition-all" style={{ width: `${WIDTHS[device]}px`, maxWidth: "100%" }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}