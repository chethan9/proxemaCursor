import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import("react-quill-new");
    const { default: Quill } = await import("quill");
    const Link = Quill.import("formats/link") as { sanitize: (url: string) => string };
    const originalSanitize = Link.sanitize;
    Link.sanitize = function (url: string) {
      const sanitized = originalSanitize.call(this, url);
      return sanitized;
    };
    const LinkClass = Quill.import("formats/link") as unknown as {
      create: (value: string) => HTMLAnchorElement;
    };
    const originalCreate = LinkClass.create;
    LinkClass.create = function (value: string) {
      const node = originalCreate.call(this, value);
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
      return node;
    };
    return RQ;
  },
  {
    ssr: false,
    loading: () => <div className="h-[180px] rounded-md border border-border bg-muted/20 animate-pulse" />,
  }
);

interface Props {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
  placeholder?: string;
}

function normalizeHtml(html: string): string {
  if (!html) return "";
  const trimmed = html.trim();
  if (trimmed === "<p><br></p>" || trimmed === "<p></p>" || trimmed === "<br>") return "";
  return trimmed;
}

const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block"],
  ["link"],
  ["clean"],
];

export function RichTextEditor({ value, onChange, rows = 6, placeholder }: Props) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const lastEmittedRef = useRef<string>(value || "");
  const minHeight = rows * 24;

  const modules = useMemo(
    () => ({
      toolbar: TOOLBAR,
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  const formats = useMemo(
    () => [
      "header",
      "bold",
      "italic",
      "underline",
      "strike",
      "list",
      "blockquote",
      "code-block",
      "link",
    ],
    []
  );

  const handleChange = (html: string) => {
    const normalized = normalizeHtml(html);
    lastEmittedRef.current = normalized;
    onChange(normalized);
  };

  const handleHtmlChange = (next: string) => {
    lastEmittedRef.current = next;
    onChange(next);
  };

  useEffect(() => {
    if (mode !== "visual") return;
    const incoming = normalizeHtml(value || "");
    if (incoming === lastEmittedRef.current) return;
    lastEmittedRef.current = incoming;
  }, [value, mode]);

  return (
    <div className="rounded-md border border-border bg-background overflow-hidden quill-wrapper">
      <div className="flex items-center justify-end border-b border-border bg-muted/30 px-1.5 py-1 gap-0.5">
        <Button
          type="button"
          variant={mode === "visual" ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setMode("visual")}
        >
          Visual
        </Button>
        <Button
          type="button"
          variant={mode === "html" ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setMode("html")}
        >
          HTML
        </Button>
      </div>
      {mode === "visual" ? (
        <div style={{ minHeight }} className="quill-visual-wrapper">
          <ReactQuill
            theme="snow"
            value={value || ""}
            onChange={handleChange}
            modules={modules}
            formats={formats}
            placeholder={placeholder}
          />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => handleHtmlChange(e.target.value)}
          className="w-full font-mono text-xs px-3 py-2.5 bg-background outline-none resize-y block"
          style={{ minHeight }}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}