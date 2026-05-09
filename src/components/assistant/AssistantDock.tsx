"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { CircleHelp, Globe, ListPlus, Loader2, Send, Square, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AssistantMessageBody } from "@/components/assistant/AssistantMessageBody";
import { stripTrailingIncompleteMarkdown } from "@/lib/assistant/streaming-markdown";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AssistantLlmKind = "openai" | "other";

function parseStoreIdFromPath(pathOnly: string): string | null {
  const m = pathOnly.match(/^\/sites\/([^/]+)/);
  const seg = m?.[1];
  if (!seg || seg.startsWith("[") || !UUID_RE.test(seg)) return null;
  return seg;
}

function useActiveStoreId(): string | null {
  const router = useRouter();
  return useMemo(() => {
    const q = router.query?.id;
    if (typeof q === "string" && UUID_RE.test(q)) return q;
    const pathOnly = router.asPath.split("?")[0].split("#")[0];
    return parseStoreIdFromPath(pathOnly);
  }, [router.asPath, router.query?.id]);
}

type Msg = { role: "user" | "assistant"; content: string; llm?: AssistantLlmKind };

function AssistantAvatar({
  llm,
  labels,
  showModelDot = true,
}: {
  llm?: AssistantLlmKind;
  labels: { help: string; openai: string; other: string };
  showModelDot?: boolean;
}) {
  const kind = llm ?? "openai";
  const tip =
    showModelDot && (kind === "openai" || kind === "other")
      ? kind === "openai"
        ? `${labels.help} · ${labels.openai}`
        : `${labels.help} · ${labels.other}`
      : labels.help;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative flex h-8 w-8 shrink-0 cursor-default items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/25">
            <CircleHelp className="h-4 w-4 text-primary" aria-hidden />
            {showModelDot && (kind === "openai" || kind === "other") ? (
              <span
                className={cn(
                  "absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full ring-2 ring-background",
                  kind === "openai" ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-500",
                )}
                aria-hidden
              />
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AssistantDock() {
  const { t } = useTranslation("site");
  const router = useRouter();
  const { user } = useAuth();
  const storeId = useActiveStoreId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const avatarLabels = useMemo(
    () => ({
      help: t("assistant.avatarHelp"),
      openai: t("assistant.avatarOpenAI"),
      other: t("assistant.avatarOtherModel"),
    }),
    [t],
  );

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingLlm, setStreamingLlm] = useState<AssistantLlmKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isRtl, setIsRtl] = useState(false);

  useEffect(() => {
    setIsRtl(typeof document !== "undefined" && document.documentElement.dir === "rtl");
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => textareaRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  /** Flat keys avoid nested `assistant.suggested.*` being wiped by DB overrides on `assistant.suggested`. */
  const suggestedDefs = [
    "suggestedReportSales",
    "suggestedProductTop",
    "suggestedProductCatalog",
  ] as const;
  const suggested = suggestedDefs.map((k) => ({
    id: k,
    label: t(`assistant.${k}`),
  }));

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamingLlm(null);
  };

  const sendInternal = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming || !user) return;

      const historyForApi: Msg[] = [...messages, { role: "user", content: trimmed }];
      setMessages([...historyForApi, { role: "assistant", content: "", llm: "openai" }]);
      setInput("");
      setError(null);
      setStreaming(true);
      setStreamingLlm("openai");

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setError(t("assistant.notSignedIn"));
          setStreaming(false);
          setStreamingLlm(null);
          setMessages((prev) => prev.slice(0, -2));
          return;
        }

        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: historyForApi.map(({ role, content }) => ({ role, content })),
            ...(storeId ? { storeId } : {}),
          }),
          signal: ac.signal,
        });

        const assistantLlm: AssistantLlmKind =
          res.headers.get("X-Assistant-LLM") === "other" ? "other" : "openai";

        if (!res.ok) {
          let msg = t("assistant.genericError");
          if (res.status === 429) {
            msg = t("assistant.rateLimited");
          }
          try {
            const j = (await res.json()) as { error?: string };
            if (typeof j?.error === "string") msg = j.error;
          } catch {
            /* ignore */
          }
          setError(msg);
          setStreaming(false);
          setStreamingLlm(null);
          setMessages((prev) => prev.slice(0, -2));
          return;
        }

        setStreamingLlm(assistantLlm);
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, llm: assistantLlm };
          }
          return copy;
        });

        const reader = res.body?.getReader();
        if (!reader) {
          setError(t("assistant.genericError"));
          setStreaming(false);
          setStreamingLlm(null);
          setMessages((prev) => prev.slice(0, -2));
          return;
        }

        const dec = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: acc, llm: assistantLlm };
            }
            return copy;
          });
        }

        setStreaming(false);
        setStreamingLlm(null);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          setStreaming(false);
          setStreamingLlm(null);
          return;
        }
        setError(t("assistant.genericError"));
        setStreaming(false);
        setStreamingLlm(null);
        setMessages((prev) => prev.slice(0, -2));
      } finally {
        abortRef.current = null;
      }
    },
    [messages, streaming, storeId, t, user],
  );

  const clearChat = () => {
    stopGeneration();
    setMessages([]);
    setError(null);
  };

  const chatPanel = (
    <div className="flex max-h-[min(90vh,800px)] w-[min(100vw-1rem,400px)] flex-col">
      {error ? (
        <div className="border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
      ) : null}

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>{t("assistant.emptyHint")}</p>
            <div className="flex flex-col gap-2">
              {suggested.map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto justify-start whitespace-normal rounded-lg border-dashed py-2.5 text-left text-xs font-normal leading-snug"
                  disabled={streaming}
                  onClick={() => void sendInternal(label)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m, i) => {
              const streamingTail =
                streaming && m.role === "assistant" && !m.content.trim() && i === messages.length - 1;
              if (streamingTail) return null;
              return (
                <div
                  key={`${i}-${m.role}`}
                  className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  {m.role === "user" ? (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border">
                      <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    </div>
                  ) : (
                    <AssistantAvatar llm={m.llm} labels={avatarLabels} />
                  )}
                  <div
                    className={cn(
                      "min-w-0 max-w-[calc(100%-2.25rem)] rounded-lg",
                      m.role === "user"
                        ? "bg-muted px-2.5 py-1.5 text-xs text-foreground"
                        : "border bg-background px-2 py-2 text-foreground sm:px-3",
                    )}
                  >
                    {m.role === "user" ? (
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    ) : streaming && i === messages.length - 1 ? (
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {stripTrailingIncompleteMarkdown(m.content)}
                      </div>
                    ) : (
                      <AssistantMessageBody content={m.content} storeId={storeId} />
                    )}
                  </div>
                </div>
              );
            })}
            {streaming &&
            messages[messages.length - 1]?.role === "assistant" &&
            !messages[messages.length - 1]?.content ? (
              <div className="flex gap-2">
                <AssistantAvatar llm={streamingLlm ?? "openai"} labels={avatarLabels} />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-[11px]">{t("assistant.thinking")}</span>
                </div>
              </div>
            ) : null}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      <div className="border-t bg-popover px-3 py-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={clearChat}>
            {t("assistant.clear")}
          </Button>
          {streaming ? (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={stopGeneration}>
              <Square className="h-3 w-3" />
              {t("assistant.stop")}
            </Button>
          ) : null}
        </div>
        <div className="rounded-xl border border-input bg-muted/40 p-1.5 shadow-inner dark:bg-muted/25">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("assistant.placeholder")}
              rows={2}
              className="min-h-[44px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={streaming}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendInternal(input);
                }
              }}
            />
            <div className="flex shrink-0 flex-col gap-1 pb-0.5 pr-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    disabled={streaming}
                    aria-label={t("assistant.quickPrompts")}
                  >
                    <ListPlus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[min(50vh,280px)] max-w-[min(100vw-2rem,320px)] overflow-y-auto">
                  {suggested.map(({ id, label }) => (
                    <DropdownMenuItem
                      key={id}
                      className="cursor-pointer whitespace-normal text-xs"
                      onClick={() => void sendInternal(label)}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                size="icon"
                variant="default"
                className="h-8 w-8 shrink-0"
                disabled={streaming || !input.trim()}
                onClick={() => void sendInternal(input)}
                aria-label={t("assistant.send")}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /** Inward from scroll FAB (`right-6` / `left-6`): gap + scroll button width (right-6 + w-11 + gap-2). */
  const dockCorner = isRtl ? "bottom-6 left-[4.75rem]" : "bottom-6 right-[4.75rem]";
  const roundDockBtn =
    "h-11 w-11 shrink-0 rounded-full border border-orange-500/35 bg-orange-500 text-white shadow-md backdrop-blur-sm hover:bg-orange-600 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-400/90";

  return (
    <div className={cn("fixed z-[10000]", dockCorner)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={roundDockBtn}
            aria-label={t("assistant.open")}
            aria-expanded={open}
          >
            <Globe className="h-5 w-5" strokeWidth={2} aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="w-auto max-w-[min(100vw-1rem,400px)] border bg-popover p-0 shadow-lg"
        >
          {chatPanel}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function GlobalAssistantDock() {
  const router = useRouter();
  const hidden =
    router.pathname.startsWith("/auth") ||
    router.pathname.startsWith("/sites/connect") ||
    router.pathname === "/templates/[id]" ||
    router.pathname === "/404";
  const { user, loading } = useAuth();

  if (hidden || loading || !user) return null;

  return <AssistantDock />;
}
