import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActivity } from "@/services/notificationAdminService";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, MousePointer, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ActivityEvent = {
  id: string;
  kind: "shown" | "clicked" | "dismissed";
  title: string;
  user_id: string | null;
  at: string;
};

function deriveEvents(rows: Awaited<ReturnType<typeof fetchActivity>>): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const r of rows) {
    if (r.shown_at) events.push({ id: `${r.id}-shown`, kind: "shown", title: r.title, user_id: r.user_id, at: r.shown_at });
    if (r.clicked_at) events.push({ id: `${r.id}-clicked`, kind: "clicked", title: r.title, user_id: r.user_id, at: r.clicked_at });
    if (r.dismissed_at && !r.clicked_at) events.push({ id: `${r.id}-dismissed`, kind: "dismissed", title: r.title, user_id: r.user_id, at: r.dismissed_at });
  }
  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 200);
}

export function ActivityLog() {
  const { data: rows = [], refetch } = useQuery({ queryKey: ["notification-activity"], queryFn: () => fetchActivity(200) });
  const [live, setLive] = useState(0);

  useEffect(() => {
    const ch = supabase
      .channel("notification-activity-admin")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_notifications" }, () => {
        setLive((n) => n + 1);
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const events = deriveEvents(rows);

  return (
    <Card className="p-0">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Live activity</h3>
          <p className="text-xs text-muted-foreground">Real-time view, click, and dismiss events across all users</p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          {live} live update{live === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="divide-y max-h-[600px] overflow-y-auto">
        {events.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No activity yet.</div>}
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
              e.kind === "clicked" ? "bg-emerald-100 text-emerald-700" :
              e.kind === "dismissed" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
            }`}>
              {e.kind === "clicked" ? <MousePointer className="h-4 w-4" /> : e.kind === "dismissed" ? <X className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate"><span className="font-medium">{e.user_id ? `User ${e.user_id.slice(0, 8)}` : "Broadcast"}</span>{" "}
                <span className="text-muted-foreground">{e.kind}</span>{" "}
                <span className="font-medium">{e.title}</span>
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}