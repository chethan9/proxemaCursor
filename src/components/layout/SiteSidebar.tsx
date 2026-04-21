import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthProvider";
import { getStores, type StoreWithClient } from "@/services/storeService";
import { getSiteMenuConfig } from "@/services/menuConfigService";
import { mergeSiteMenu, resolveForSiteSidebar, buildInitialSiteTree, type ResolvedMenuNode } from "@/lib/menu-merge";
import { resolveIcon } from "@/lib/menu-registry";
import { SiteIcon } from "@/components/site/SiteIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Search, Check } from "lucide-react";
import type { RoleKey } from "@/services/menuConfigService";
import { useQueryClient } from "@tanstack/react-query";
import { fetchProducts } from "@/services/productService";
import { fetchOrders } from "@/services/orderService";
import { fetchCategories, fetchTags } from "@/services/taxonomyService";
import { queryKeys } from "@/lib/query-client";

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

export function SiteSidebar({ siteId }: Props) {
  const router = useRouter();
  const { profile, isSuperAdmin, can } = useAuth();
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
  const queryClient = useQueryClient();

  const currentSite = useMemo(() => sites.find((s) => s.id === siteId), [sites, siteId]);

  useEffect(() => {
    getStores().then((list) => {
      const cachedHash = sites.map((s) => `${s.id}:${s.updated_at || ""}`).join("|");
      const newHash = list.map((s) => `${s.id}:${s.updated_at || ""}`).join("|");
      cachedSites = list;
      try { localStorage.setItem("sidebar-sites-cache", JSON.stringify(list)); } catch { /* ignore */ }
      if (cachedHash !== newHash) setSites(list);
    }).catch(() => { /* keep cached */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
  }, [roleKey, siteId]);

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
    const sub = getCurrentSubPath();
    router.push(`/sites/${newId}${sub}`);
    setOpen(false);
    setSearch("");
  };

  const isItemActive = (href: string): boolean => {
    const current = router.asPath.split("?")[0].split("#")[0];
    if (href === `/sites/${siteId}`) return current === href;
    return current === href || current.startsWith(href + "/");
  };

  const prefetchForHref = (href: string) => {
    // Match /sites/:id/(products|orders|categories|tags)
    const m = href.match(/^\/sites\/([^/]+)\/(products|orders|categories|tags)$/);
    if (!m) return;
    const [, sid, section] = m;
    if (section === "products") {
      const opts = { storeId: sid, page: 0, pageSize: 50 };
      queryClient.prefetchQuery({
        queryKey: queryKeys.products(sid, opts as unknown as Record<string, unknown>),
        queryFn: () => fetchProducts(opts),
      });
    } else if (section === "orders") {
      const opts = { storeId: sid, page: 0, pageSize: 50 };
      queryClient.prefetchQuery({
        queryKey: queryKeys.orders(sid, opts as unknown as Record<string, unknown>),
        queryFn: () => fetchOrders(opts),
      });
    } else if (section === "categories") {
      queryClient.prefetchQuery({
        queryKey: ["taxonomy", "categories", sid, "", 0, 50] as const,
        queryFn: () => fetchCategories(sid, "", 0, 50),
      });
    } else if (section === "tags") {
      queryClient.prefetchQuery({
        queryKey: ["taxonomy", "tags", sid, "", 0, 50] as const,
        queryFn: () => fetchTags(sid, "", 0, 50),
      });
    }
  };

  const renderItem = (node: ResolvedMenuNode) => {
    if (node.type !== "item" || !node.href) return null;
    const active = isItemActive(node.href);
    const Icon = resolveIcon(node.icon);
    return (
      <li key={node.id}>
        <Link
          href={node.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            active
              ? "bg-foreground/[0.08] text-foreground font-semibold"
              : "font-medium text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
          )}
          onMouseEnter={() => node.href && prefetchForHref(node.href)}
          onFocus={() => node.href && prefetchForHref(node.href)}
        >
          {active && (
            <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-foreground" />
          )}
          <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-foreground/60")} style={node.iconColor ? { color: node.iconColor } : undefined} aria-hidden />
          <span className="truncate">{node.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <aside className="flex shrink-0 flex-col w-52 bg-background border-r border-border">
      {/* Site switcher */}
      <div className="h-12 flex items-center px-2 border-b border-border">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="w-full flex items-center gap-2 rounded-md border border-border px-2 py-1.5 hover:bg-accent/60 transition-colors"
              aria-label="Switch site"
            >
              {currentSite ? (
                <>
                  <SiteIcon site={currentSite} size={20} />
                  <span className="flex-1 text-left text-sm font-medium truncate">{currentSite.name}</span>
                </>
              ) : (
                <span className="flex-1 text-left text-sm text-muted-foreground">Select site…</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sites…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {filteredSites.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">No sites found</div>
              ) : filteredSites.map((s) => {
                const active = s.id === siteId;
                return (
                  <button
                    key={s.id}
                    onClick={() => switchToSite(s.id)}
                    className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/60 transition-colors",
                      active && "bg-accent/40 font-medium")}
                  >
                    <SiteIcon site={s} size={20} />
                    <span className="flex-1 text-left truncate">{s.name}</span>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                      s.status === "connected" ? "bg-success" : "bg-muted-foreground/30")} />
                    {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground">
              {sites.length} site{sites.length !== 1 ? "s" : ""}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menuTree.map((node) => {
          if (node.type === "item") {
            return (
              <div key={node.id} className="mb-1 px-2">
                <ul>{renderItem(node)}</ul>
              </div>
            );
          }
          return (
            <div key={node.id} className="mb-3 px-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {node.label}
              </p>
              <ul className="space-y-0.5">{node.children?.map(renderItem)}</ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}