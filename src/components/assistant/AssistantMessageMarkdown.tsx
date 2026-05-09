"use client";

import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResolvedStoreImage } from "@/components/assistant/ResolvedStoreImage";

type Props = {
  content: string;
  /** When set, product images resolve Cloudflare thumb → card → source. */
  storeId?: string | null;
};

function isProductEditPath(href: string): boolean {
  return /^\/sites\/[^/]+\/products\/edit\/[^/]+$/.test(href);
}

function childHasFigure(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (c) => {
    if (found) return;
    if (isValidElement(c) && c.type === "figure") found = true;
  });
  return found;
}

function partitionAnchorChildren(children: ReactNode): { head: ReactNode[]; figure: ReactElement | null } {
  const head: ReactNode[] = [];
  let figure: ReactElement | null = null;
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === "figure") figure = c;
    else head.push(c);
  });
  return { head, figure };
}

export function AssistantMessageMarkdown({ content, storeId = null }: Props) {
  return (
    <div
      className={cn(
        "assistant-md text-sm leading-relaxed",
        /* Card per item in ordered (ranked) lists */
        "[&_ol>li]:rounded-lg [&_ol>li]:border [&_ol>li]:border-border/80 [&_ol>li]:bg-gradient-to-b [&_ol>li]:from-muted/50 [&_ol>li]:to-muted/25 [&_ol>li]:p-2 [&_ol>li]:shadow-sm [&_ol>li]:ring-1 [&_ol>li]:ring-black/[0.04] dark:[&_ol>li]:ring-white/[0.06]",
        "[&_ol>li_ul]:mt-1.5 [&_ol>li_ul]:ml-1 [&_ol>li_ul]:space-y-0.5 [&_ol>li_ul]:text-[11px] [&_ol>li_ul]:leading-snug [&_ol>li_ul]:text-muted-foreground",
        "[&_ol>li_ul]:list-disc [&_ol>li_ul]:marker:text-muted-foreground/80",
        "[&_ol>li>p]:mb-2 [&_ol>li>p:last-child]:mb-0",
        /* Product-style rows: title full width; thumbnail | stats side by side */
        "[&_ol>li:has(figure):has(ul)]:grid [&_ol>li:has(figure):has(ul)]:grid-cols-[minmax(0,120px)_minmax(0,1fr)] [&_ol>li:has(figure):has(ul)]:gap-x-2 [&_ol>li:has(figure):has(ul)]:gap-y-1.5 [&_ol>li:has(figure):has(ul)]:items-start",
        "[&_ol>li:has(figure):has(ul)>*:first-child]:col-span-full",
        "[&_ol>li:has(figure):has(ul)>p:has(figure)]:col-start-1 [&_ol>li:has(figure):has(ul)>p:has(figure)]:row-start-2 [&_ol>li:has(figure):has(ul)>p:has(figure)]:mb-0 [&_ol>li:has(figure):has(ul)>p:has(figure)]:mt-0",
        "[&_ol>li:has(figure):has(ul)>figure]:col-start-1 [&_ol>li:has(figure):has(ul)>figure]:row-start-2 [&_ol>li:has(figure):has(ul)>figure]:my-0",
        "[&_ol>li:has(figure):has(ul)>ul]:col-start-2 [&_ol>li:has(figure):has(ul)>ul]:row-start-2 [&_ol>li:has(figure):has(ul)>ul]:my-0 [&_ol>li:has(figure):has(ul)>ul]:ml-0 [&_ol>li:has(figure):has(ul)>ul]:self-center [&_ol>li:has(figure):has(ul)>ul]:pt-0.5",
        "[&_ol>li:has(figure):has(ul)>a:has(figure)]:col-start-1 [&_ol>li:has(figure):has(ul)>a:has(figure)]:row-start-2 [&_ol>li:has(figure):has(ul)>a:has(figure)]:self-start",
        "[&_ol>li:has(figure):has(ul)_figure]:my-0",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            const productEdit = href.startsWith("/") && isProductEditPath(href);
            const figWrap = productEdit && childHasFigure(children);

            if (href.startsWith("/")) {
              if (figWrap) {
                const { head, figure } = partitionAnchorChildren(children);
                return (
                  <div className="contents">
                    <Link
                      href={href}
                      className="col-span-full inline-flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-primary/8 px-2 py-1 text-xs font-semibold text-primary underline-offset-2 hover:bg-primary/12"
                    >
                      {head}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    </Link>
                    <Link
                      href={href}
                      className="col-start-1 row-start-2 block w-fit max-w-full self-start overflow-hidden rounded-xl no-underline ring-1 ring-border/70 shadow-sm transition hover:ring-primary/40 hover:shadow-md"
                    >
                      {figure}
                    </Link>
                  </div>
                );
              }
              return (
                <Link
                  href={href}
                  className={cn(
                    productEdit &&
                      "inline-flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-primary/8 px-2 py-1 text-xs font-semibold text-primary underline-offset-2 hover:bg-primary/12",
                    !productEdit && "font-medium text-primary underline underline-offset-2 hover:opacity-90",
                  )}
                >
                  {children}
                  {productEdit ? (
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  ) : null}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-1 text-[13px] marker:text-foreground/70 [&_ul]:mt-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-0 list-none space-y-2 [list-style:none] [&_ol]:ml-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
          img: ({ src, alt }) => {
            const raw = typeof src === "string" ? src.trim() : "";
            const url =
              raw.startsWith("https://") || raw.startsWith("http://")
                ? raw
                : raw.startsWith("//")
                  ? `https:${raw}`
                  : null;
            if (!url) return null;
            return (
              <figure className="my-2 not-prose first:mt-0">
                <div className="inline-block overflow-hidden rounded-xl border border-border/90 bg-muted/50 shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10">
                  <ResolvedStoreImage
                    storeId={storeId}
                    src={url}
                    alt={typeof alt === "string" ? alt : "Product"}
                    imgClassName="block max-h-20 w-auto max-w-[min(100%,120px)] object-contain"
                  />
                </div>
              </figure>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
