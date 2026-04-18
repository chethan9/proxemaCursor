import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";

const LABEL_MAP: Record<string, string> = {
  "": "Dashboard",
  clients: "Clients",
  sites: "Sites",
  "sync-runs": "Sync Runs",
  webhooks: "Webhooks",
  activity: "Activity",
  "api-management": "API Management",
  settings: "Settings",
  profile: "Profile",
  theme: "Theme",
  users: "Users",
  roles: "Roles",
  "payment-methods": "Payment Methods",
  "menu-editor": "Menu Editor",
  explore: "Explore",
  connect: "Connect",
  auth: "Auth",
  login: "Login",
  signup: "Sign Up",
};

function humanize(segment: string): string {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment];
  if (/^[0-9a-f-]{20,}$/i.test(segment)) return "Detail";
  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const router = useRouter();

  const crumbs = useMemo(() => {
    const path = router.asPath.split("?")[0].split("#")[0];
    const parts = path.split("/").filter(Boolean);
    const items: { label: string; href: string }[] = [{ label: "Dashboard", href: "/" }];
    let acc = "";
    parts.forEach((p) => {
      acc += `/${p}`;
      items.push({ label: humanize(p), href: acc });
    });
    return items;
  }, [router.asPath]);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="h-12 flex items-center border-b border-border bg-background px-6">
      <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />}
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {i === 0 && <Home className="inline h-3 w-3 mr-1 -mt-0.5" />}
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="hover:text-foreground transition-colors flex items-center gap-1">
                  {i === 0 && <Home className="h-3 w-3" />}
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}