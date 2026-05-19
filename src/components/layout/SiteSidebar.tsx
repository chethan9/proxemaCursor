import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthProvider";
import { type StoreWithClient } from "@/services/storeService";
import { useStores } from "@/hooks/queries/useStores";
import { getSiteMenuConfig } from "@/services/menuConfigService";
import { mergeSiteMenu, resolveForSiteSidebar, buildInitialSiteTree, type ResolvedMenuNode } from "@/lib/menu-merge";
import { resolveIcon } from "@/lib/menu-registry";
import { SiteIcon } from "@/components/site/SiteIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronsLeft, ChevronsRight, Search, Check } from "lucide-react";
import type { RoleKey } from "@/services/menuConfigService";
import { useQueryClient } from "@tanstack/react-query";
import { fetchSiteHomeStats, type SiteHomeStatsQuery } from "@/services/siteStatsService";

const DEFAULT_HOME_STATS_QUERY: SiteHomeStatsQuery = { range: "30d", combineAll: false };
import { listSiteDownloads } from "@/services/downloadsService";
import { listBulkJobs } from "@/services/bulkJobService";
import { getStore } from "@/services/storeService";
import { queryKeys } from "@/lib/query-client";
import { warmSiteExplorerPrefetch } from "@/lib/prefetch-site-explorer";
import { useStoreBulkJobs } from "@/hooks/queries/useBulkJobs";
import { computeBulkJobSidebarBadgeCounts, useBulkJobNotificationDismiss } from "@/hooks/useBulkJobNotificationDismiss";
import { useUnseenDownloadCount } from "@/hooks/useUnseenDownloadCount";
import { useTranslation } from "next-i18next";

type Props = { siteId: string };

const cachedSiteMenuByKey = new Map<string, ResolvedMenuNode[]>();
let cachedSites: StoreWithClient[] | null = null;

function loadCachedSites(): StoreWithClient[] {
  if (cachedSites) return cachedSites;
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("sidebar-sites-cache");
    if (raw) {
      const parsed = JSON.parse(raw) as StoreWithClient[];
      cachedSites = parsed;
      return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function roleKeyFor(profileRole: string | undefined, isSuperAdmin: boolean): RoleKey {
  if (isSuperAdmin) return "super_admin";
  if (profileRole === "admin") return "admin";
  return "user";
}

function collectMenuHrefs(nodes: ResolvedMenuNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === "item" && n.href) out.push(n.href);
    if (n.children?.length) out.push(...collectMenuHrefs(n.children));
  }
  return out;
}

export function SiteSidebar({ siteId }: Props) {
  const router = useRouter();
  const { profile, isSuperAdmin, can, profileLoaded } = useAuth();
  const { data: storesList } = useStores();
  const { t } = useTranslation("common");
  const [sites, setSites] = useState<StoreWithClient[]>(() => loadCachedSites());
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const roleKey = roleKeyFor(profile?.role, isSuperAdmin);
  const menuCacheKey = `${roleKey}:${siteId}`;
  const [menuTree, setMenuTree] = useState<ResolvedMenuNode[]>(() => {
    const cached = cachedSiteMenuByKey.get(menuCacheKey);
    if (cached) return cached;
    return buildInitialSiteTree(siteId, can);
  });
  /** Matches primary AppSidebar: read rail pref synchronously so navigations/remounts never flash expanded width. */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("site-sidebar-collapsed") === "1";
  });
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  /** Immediate tab highlight while Next.js loads the page chunk (router.asPath updates late). */
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const { data: bulkJobs = [] } = useStoreBulkJobs(siteId, 50);
  const { dismissedAt: bulkJobsDismissedAt } = useBulkJobNotificationDismiss(siteId);
  const unseenDownloads = useUnseenDownloadCount(siteId);
  const bulkJobsCounts = useMemo(
    () => computeBulkJobSidebarBadgeCounts(bulkJobs, bulkJobsDismissedAt),
    [bulkJobs, bulkJobsDismissedAt],
  );

  const currentSite = useMemo(() => sites.find((s) => s.id === siteId), [sites, siteId]);

  useEffect(() => {
    if (!storesList?.length) return;
    const list = storesList;
    const cachedHash = sites.map((s) => `${s.id}:${s.updated_at || ""}`).join("|");
    const newHash = list.map((s) => `${s.id}:${s.updated_at || ""}`).join("|");
    cachedSites = list;
    try { localStorage.setItem("sidebar-sites-cache", JSON.stringify(list)); } catch { /* ignore */ }
    if (cachedHash !== newHash) setSites(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storesList]);

  useEffect(() => {
    if (!profileLoaded) return;
    const cached = cachedSiteMenuByKey.get(menuCacheKey);
    if (cached) {
      setMenuTree((prev) => (JSON.stringify(prev) === JSON.stringify(cached) ? prev : cached));
    } else {
      const defaults = buildInitialSiteTree(siteId, can);
      setMenuTree((prev) => (JSON.stringify(prev) === JSON.stringify(defaults) ? prev : defaults));
    }
    getSiteMenuConfig(roleKey, siteId).then((cfg) => {
      const { tree } = mergeSiteMenu(cfg);
      const resolved = resolveForSiteSidebar(tree, siteId, can);
      cachedSiteMenuByKey.set(menuCacheKey, resolved);
      setMenuTree((prev) => (JSON.stringify(prev) === JSON.stringify(resolved) ? prev : resolved));
    }).catch(() => { /* keep current */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleKey, siteId, profileLoaded]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const n of menuTree) {
      if (n.type !== "group") continue;
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(`site-sidebar-group-expanded:${n.id}`) : null;
      next[n.id] = stored == null ? true : stored === "1";
    }
    setGroupExpanded(next);
  }, [menuTree]);

  const setRailCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem("site-sidebar-collapsed", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSiteNavGroup = useCallback((id: string) => {
    setGroupExpanded((prev) => {
      const wasExpanded = prev[id] !== false;
      const nextOpen = !wasExpanded;
      try {
        localStorage.setItem(`site-sidebar-group-expanded:${id}`, nextOpen ? "1" : "0");
      } catch {
        /* ignore */
      }
      return { ...prev, [id]: nextOpen };
    });
  }, []);

  useEffect(() => {
    const onRouteSettled = () => setPendingPath(null);
    router.events.on("routeChangeComplete", onRouteSettled);
    router.events.on("routeChangeError", onRouteSettled);
    return () => {
      router.events.off("routeChangeComplete", onRouteSettled);
      router.events.off("routeChangeError", onRouteSettled);
    };
  }, [router.events]);

  useEffect(() => {
    if (!pendingPath) return;
    const cur = router.asPath.split("?")[0].split("#")[0];
    const pend = pendingPath.split("?")[0].split("#")[0];
    if (cur === pend || cur.startsWith(pend + "/")) setPendingPath(null);
  }, [router.asPath, pendingPath]);

  const beginSiteNavigation = useCallback((href: string) => {
    const p = href.split("?")[0].split("#")[0];
    setPendingPath(p);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hrefs = [...new Set(collectMenuHrefs(menuTree))];
    if (hrefs.length === 0) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      /** Cap idle work — hover/focus warmup handles hot paths with correct query keys. */
      for (const href of hrefs.slice(0, 10)) void router.prefetch(href);
    };
    const ric = window.requestIdleCallback?.bind(window);
    if (ric) {
      const id = ric(run, { timeout: 1500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(run, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [menuTree, router]);

  const filteredSites = useMemo(() => {
    if (!search.trim()) return sites;
    const q = search.toLowerCase();
    return sites.filter((s) => s.name.toLowerCase().includes(q) || (s.url || "").toLowerCase().includes(q));
  }, [sites, search]);

  const getCurrentSubPath = (): string => {
    // Extract everything after /sites/[id] -- e.g. "/orders", "/products", or ""
    const match = router.asPath.match(/^\/sites\/[^/?#]+(\/[^?#]*)?/);
    if (!match) return "";
    return match[1] || "";
  };

  const switchToSite = (newId: string) => {
    if (newId === siteId) { setOpen(false); return; }
    const pathOnly = router.asPath.split("?")[0].split("#")[0];
    const next =
      pathOnly.startsWith(`/projects/${siteId}/cloudflare`)
        ? `/projects/${newId}/cloudflare`
        : `/sites/${newId}${getCurrentSubPath()}`;
    beginSiteNavigation(next);
    router.push(next);
    setOpen(false);
    setSearch("");
  };

  const isItemActive = useCallback(
    (href: string): boolean => {
      const norm = (p: string) => p.split("?")[0].split("#")[0];
      const current = norm(pendingPath ?? router.asPath);
      if (href === `/sites/${siteId}`) return current === href;
      return current === href || current.startsWith(href + "/");
    },
    [pendingPath, router.asPath, siteId]
  );

  /** Next.js route chunk + infinite-query cache (matches OrdersTab/ProductsTab/etc. keys). */
  const warmRouteAndData = useCallback(
    (href: string | undefined) => {
      if (!href) return;
      const norm = href.split("?")[0].split("#")[0];
      void router.prefetch(norm);

      const pathMatch = norm.match(/^\/sites\/([^/]+)\/([^/?#]+)/);
      if (!pathMatch) return;
      const sid = pathMatch[1];
      const section = pathMatch[2];

      if (section === "products" || section === "orders" || section === "customers" || section === "categories" || section === "tags" || section === "brands") {
        void warmSiteExplorerPrefetch(queryClient, sid, section);
        return;
      }
      if (section === "home") {
        queryClient.prefetchQuery({
          queryKey: ["site-home-stats", sid, null, null, "30d", "", "", false],
          queryFn: () => fetchSiteHomeStats(sid, undefined, undefined, DEFAULT_HOME_STATS_QUERY),
        });
      } else if (section === "downloads") {
        queryClient.prefetchQuery({
          queryKey: ["site-downloads", sid],
          queryFn: () => listSiteDownloads(sid),
        });
      } else if (section === "bulk-jobs") {
        queryClient.prefetchQuery({
          queryKey: ["bulk-jobs", "store", sid, 50],
          queryFn: () => listBulkJobs(sid, 50),
        });
      } else if (section === "settings") {
        queryClient.prefetchQuery({
          queryKey: queryKeys.store(sid),
          queryFn: () => getStore(sid),
        });
      }
    },
    [queryClient, router]
  );

  const renderItem = (node: ResolvedMenuNode, opts?: { onAfterNavigate?: () => void; compact?: boolean }) => {
    if (node.type !== "item" || !node.href) return null;
    const compact = opts?.compact ?? false;
    const active = isItemActive(node.href);
    const Icon = resolveIcon(node.icon);
    const isBulkJobs = node.href.endsWith("/bulk-jobs");
    const isDownloads = node.href.endsWith("/downloads");
    const showPending = isBulkJobs && bulkJobsCounts.pending > 0;
    const showRecent = isBulkJobs && bulkJobsCounts.recent > 0;
    const showDownloadsUnseen = isDownloads && unseenDownloads > 0;
    const hasCompactBadge = compact && (showPending || showRecent || showDownloadsUnseen);
    // Map href section → nav.<key>; falls back to stored label so user customizations win.
    const projectsCf = node.href.match(/^\/projects\/[^/]+\/(cloudflare)$/);
    const sectionMatch = node.href.match(/\/sites\/[^/]+\/?([^/?#]*)/);
    const section = projectsCf ? projectsCf[1] : (sectionMatch ? sectionMatch[1] : "");
    const navKey =
      section === "" ? "home" :
      section === "bulk-jobs" ? "bulkJobs" :
      section === "sync-runs" ? "syncRuns" :
      section === "settings" ? "configuration" :
      section;
    const label = t(`nav.${navKey}`, { defaultValue: node.label });
    const link = (
      <Link
        href={node.href}
        onClick={() => {
          beginSiteNavigation(node.href!);
          opts?.onAfterNavigate?.();
        }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center rounded-md text-[13px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          compact
            ? "size-9 shrink-0 justify-center p-0"
            : "gap-2.5 px-2.5 py-1.5",
          active
            ? "bg-sidebar-active text-sidebar-active-foreground font-semibold shadow-[inset_0_0_0_1px_hsl(var(--border))]"
            : "font-medium text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
        )}
        onMouseEnter={() => node.href && warmRouteAndData(node.href)}
        onFocus={() => node.href && warmRouteAndData(node.href)}
      >
        {active && (
          <span
            aria-hidden
            className={cn(
              "absolute start-0 w-0.5 rounded-e-full bg-sidebar-primary",
              compact ? "top-1.5 bottom-1.5" : "top-1.5 bottom-1.5"
            )}
          />
        )}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            !node.iconColor && (active ? "text-sidebar-active-foreground" : "text-foreground/60"),
          )}
          style={node.iconColor ? { color: node.iconColor } : undefined}
          aria-hidden
        />
        {hasCompactBadge && (
          <span
            className="absolute top-0.5 end-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
            aria-hidden
          />
        )}
        {!compact && <span className="truncate flex-1">{label}</span>}
        {!compact && showPending && (
          <span
            title={t("bulkJobsBadge.running", { count: bulkJobsCounts.pending })}
            className="inline-flex items-center justify-center min-w-[1.25rem] h-[1.125rem] px-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-semibold tabular-nums"
          >
            {bulkJobsCounts.pending}
          </span>
        )}
        {!compact && showRecent && !showPending && (
          <span
            title={t("bulkJobsBadge.completed", { count: bulkJobsCounts.recent })}
            className="inline-flex items-center justify-center min-w-[1.25rem] h-[1.125rem] px-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold tabular-nums"
          >
            {bulkJobsCounts.recent}
          </span>
        )}
        {!compact && showDownloadsUnseen && (
          <span
            title={t("downloadsBadge.new", { count: unseenDownloads })}
            className="inline-flex items-center justify-center min-w-[1.25rem] h-[1.125rem] px-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold tabular-nums"
          >
            {unseenDownloads}
          </span>
        )}
      </Link>
    );
    if (compact) {
      return (
        <li key={node.id} className="flex w-full justify-center">
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="z-[100]">
              {label}
            </TooltipContent>
          </Tooltip>
        </li>
      );
    }
    return <li key={node.id}>{link}</li>;
  };

  const siteSwitcherPopover = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md border border-border transition-colors hover:bg-accent/60",
            collapsed
              ? "size-9 shrink-0 justify-center border-border p-0"
              : "w-full min-w-0 px-2 py-1.5",
          )}
          aria-label={t("siteSwitcher.switchSite")}
        >
          {currentSite ? (
            <>
              <SiteIcon site={currentSite} size={collapsed ? 22 : 20} />
              {!collapsed && (
                <span className="flex-1 text-start text-sm font-medium truncate">{currentSite.name}</span>
              )}
            </>
          ) : (
            !collapsed && (
              <span className="flex-1 text-start text-sm text-muted-foreground">{t("siteSwitcher.selectSite")}</span>
            )
          )}
          {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("siteSwitcher.searchSites")}
              className="h-8 ps-7 text-sm"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filteredSites.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">{t("siteSwitcher.noSitesFound")}</div>
          ) : filteredSites.map((s) => {
            const active = s.id === siteId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => switchToSite(s.id)}
                className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/60 transition-colors",
                  active && "bg-accent/40 font-medium")}
              >
                <SiteIcon site={s} size={20} />
                <span className="flex-1 text-start truncate">{s.name}</span>
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                  s.status === "connected" ? "bg-success" : "bg-muted-foreground/30")} />
                {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground">
          {t("siteSwitcher.siteCount", { count: sites.length })}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label={t("siteSidebar.ariaNav", { defaultValue: "Site menu" })}
        className={cn(
          "flex shrink-0 flex-col bg-background border-r border-border transition-[width] duration-200",
          collapsed ? "w-14" : "w-44"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 border-b border-border",
            collapsed
              ? "flex-col items-center gap-1.5 py-2 px-1"
              : "h-12 items-center px-2 gap-1",
          )}
        >
          {collapsed ? (
            <>
              <button
                type="button"
                onClick={() => setRailCollapsed(false)}
                aria-label={t("sidebar.expand")}
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
              <div className="flex size-9 shrink-0 items-center justify-center">{siteSwitcherPopover}</div>
            </>
          ) : (
            <div className="flex w-full min-w-0 items-center gap-1">
              <div className="min-w-0 flex-1">{siteSwitcherPopover}</div>
              <button
                type="button"
                onClick={() => setRailCollapsed(true)}
                aria-label={t("sidebar.collapse")}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <nav
          className={cn(
            "min-h-0 flex-1 overflow-y-auto py-2",
            collapsed && "flex flex-col items-stretch",
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 px-1">
              {menuTree.map((node, groupIdx) => {
                if (node.type === "item") {
                  return (
                    <ul key={node.id} className="flex w-full flex-col items-center gap-1">
                      {renderItem(node, { compact: true })}
                    </ul>
                  );
                }
                const children = node.children ?? [];
                return (
                  <div key={node.id} className="flex w-full flex-col items-center gap-1">
                    {groupIdx > 0 && (
                      <div
                        className="my-0.5 h-px w-8 shrink-0 bg-border/60"
                        aria-hidden
                      />
                    )}
                    <ul className="flex w-full flex-col items-center gap-1">
                      {children.map((c) => renderItem(c, { compact: true }))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            menuTree.map((node) => {
              if (node.type === "item") {
                return (
                  <div key={node.id} className="mb-1 px-2">
                    <ul>{renderItem(node)}</ul>
                  </div>
                );
              }
              const children = node.children ?? [];
              const hasActiveChild = children.some(
                (c) => c.type === "item" && c.href && isItemActive(c.href),
              );
              const groupLabel = t(`siteNavGroups.${node.label}`, { defaultValue: node.label });
              const sectionOpen = hasActiveChild || groupExpanded[node.id] !== false;
              return (
                <div key={node.id} className="mb-3 px-2">
                  <button
                    type="button"
                    onClick={() => toggleSiteNavGroup(node.id)}
                    aria-expanded={sectionOpen}
                    className={cn(
                      "w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                      "hover:bg-foreground/[0.04] hover:text-foreground transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    )}
                  >
                    <span className="flex-1 text-start truncate">
                      {groupLabel}
                    </span>
                    <ChevronDown
                      className={cn("h-3 w-3 shrink-0 transition-transform", !sectionOpen && "-rotate-90 rtl:rotate-90")}
                      aria-hidden
                    />
                  </button>
                  {sectionOpen && (
                    <ul className="space-y-0.5">{children.map((c) => renderItem(c))}</ul>
                  )}
                </div>
              );
            })
          )}
        </nav>
      </aside>
    </TooltipProvider>
  );
}