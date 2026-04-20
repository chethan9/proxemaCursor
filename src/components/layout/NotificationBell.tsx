import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface NotifRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  created_at: string;
}

const ANNOUNCEMENT_TYPES = new Set(["announcement", "ad"]);
const CLEAR_KEY = "notifications-counter-cleared-at";

export function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotifRow[]>([]);
  const [clearedAt, setClearedAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CLEAR_KEY);
  });

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("user_notifications")
        .select("id, type, title, body, cta_label, cta_url, image_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (mounted && data) setRows(data as NotifRow[]);
    };
    load();
    const channel = supabase
      .channel(`bell-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    const interval = setInterval(load, 60_000);
    return () => { mounted = false; supabase.removeChannel(channel); clearInterval(interval); };
  }, [user]);

  const { notifications, announcements, unread } = useMemo(() => {
    const ann: NotifRow[] = [];
    const notif: NotifRow[] = [];
    for (const r of rows) {
      if (ANNOUNCEMENT_TYPES.has(r.type)) ann.push(r);
      else notif.push(r);
    }
    const cutoff = clearedAt ? new Date(clearedAt).getTime() : 0;
    const unreadCount = rows.filter((r) => new Date(r.created_at).getTime() > cutoff).length;
    return { notifications: notif, announcements: ann, unread: unreadCount };
  }, [rows, clearedAt]);

  const clearCounter = () => {
    const now = new Date().toISOString();
    localStorage.setItem(CLEAR_KEY, now);
    setClearedAt(now);
  };

  const bellButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Notifications"
      className={cn(
        "relative flex items-center rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary",
        collapsed
          ? "h-9 w-9 justify-center mx-auto hover:bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
          : "w-full gap-2.5 px-2.5 py-1.5 text-[13px] font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Bell className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">Notifications</span>}
      {unread > 0 && (
        <span
          className={cn(
            "rounded-full bg-destructive text-white text-[9px] font-bold tabular-nums flex items-center justify-center ring-1 ring-sidebar",
            "animate-in zoom-in-50 fade-in duration-300",
            collapsed
              ? "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1"
              : "ml-auto min-w-[18px] h-[16px] px-1"
          )}
        >
          <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-40" aria-hidden="true" />
          <span className="relative">{unread > 99 ? "99+" : unread}</span>
        </span>
      )}
    </button>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{bellButton}</TooltipTrigger>
          <TooltipContent side="right">Notifications{unread > 0 ? ` (${unread})` : ""}</TooltipContent>
        </Tooltip>
      ) : bellButton}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[420px] sm:w-[480px] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="notifications" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 grid grid-cols-2">
              <TabsTrigger value="notifications">
                Notifications {notifications.length > 0 && <span className="ml-1.5 text-xs opacity-60">({notifications.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="announcements">
                Announcements {announcements.length > 0 && <span className="ml-1.5 text-xs opacity-60">({announcements.length})</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notifications" className="flex-1 overflow-y-auto px-6 py-3 mt-0">
              <NotifList items={notifications} emptyLabel="No notifications yet" />
            </TabsContent>
            <TabsContent value="announcements" className="flex-1 overflow-y-auto px-6 py-3 mt-0">
              <NotifList items={announcements} emptyLabel="No announcements yet" />
            </TabsContent>
          </Tabs>

          <SheetFooter className="px-6 py-4 border-t flex-row gap-2 sm:justify-between">
            <Button variant="outline" size="sm" onClick={clearCounter} disabled={unread === 0}>
              Clear notifications counter
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NotifList({ items, emptyLabel }: { items: NotifRow[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-10">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((n) => (
        <div key={n.id} className="border rounded-md p-3 bg-card">
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="font-medium text-sm truncate">{n.title}</p>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </span>
          </div>
          {n.body && <p className="text-xs text-muted-foreground whitespace-pre-line">{n.body}</p>}
          {n.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.image_url} alt="" className="mt-2 rounded w-full max-h-40 object-cover" />
          )}
          {n.cta_url && (
            <a href={n.cta_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-primary underline">
              {n.cta_label || "Open link"}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}