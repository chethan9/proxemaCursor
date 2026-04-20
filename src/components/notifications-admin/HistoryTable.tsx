import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchHistory, revokeGroup, type SentNotificationGroup, type NotificationType } from "@/services/notificationAdminService";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { exportCsv } from "@/lib/exportCsv";
import { Search, Download, Ban, Copy, Eye, TrendingUp, Users, Send, MousePointer } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ComposePayload } from "@/services/notificationAdminService";

const TYPE_COLORS: Record<NotificationType, string> = {
  celebration: "bg-orange-100 text-orange-800",
  announcement: "bg-blue-100 text-blue-800",
  ad: "bg-purple-100 text-purple-800",
  milestone: "bg-amber-100 text-amber-800",
  info: "bg-slate-100 text-slate-800",
  warning: "bg-rose-100 text-rose-800",
};

export function HistoryTable({ onDuplicate }: { onDuplicate: (prefill: Partial<ComposePayload>) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: history = [], isLoading } = useQuery({ queryKey: ["notification-history"], queryFn: fetchHistory });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<SentNotificationGroup | null>(null);

  const filtered = useMemo(() => {
    return history.filter((h) => {
      if (typeFilter !== "all" && h.type !== typeFilter) return false;
      if (search && !h.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [history, search, typeFilter]);

  const stats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recent = history.filter((h) => new Date(h.created_at).getTime() > sevenDaysAgo);
    const totalShown = recent.reduce((s, h) => s + h.shown_count, 0);
    const totalClicked = recent.reduce((s, h) => s + h.clicked_count, 0);
    const totalDismissed = recent.reduce((s, h) => s + h.dismissed_count, 0);
    const top = [...history].filter((h) => h.shown_count > 5).sort((a, b) => b.ctr - a.ctr)[0];
    return {
      sent7d: recent.length,
      avgCtr: totalShown > 0 ? (totalClicked / totalShown) * 100 : 0,
      avgDismiss: totalShown > 0 ? (totalDismissed / totalShown) * 100 : 0,
      top: top?.title || "—",
    };
  }, [history]);

  const handleRevoke = async (g: SentNotificationGroup) => {
    if (!confirm(`Revoke "${g.title}"? Unshown recipients will stop receiving it.`)) return;
    try {
      await revokeGroup(g.group_id);
      toast({ title: "Revoked", description: "Future impressions stopped." });
      qc.invalidateQueries({ queryKey: ["notification-history"] });
    } catch (e) {
      toast({ title: "Revoke failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const columns = [
      { key: "created_at", label: "Sent", accessor: (h: SentNotificationGroup) => h.created_at },
      { key: "type", label: "Type", accessor: (h: SentNotificationGroup) => h.type },
      { key: "title", label: "Title", accessor: (h: SentNotificationGroup) => h.title },
      { key: "target", label: "Target", accessor: (h: SentNotificationGroup) => h.target_description },
      { key: "recipients", label: "Recipients", accessor: (h: SentNotificationGroup) => h.recipients },
      { key: "shown", label: "Shown", accessor: (h: SentNotificationGroup) => h.shown_count },
      { key: "clicked", label: "Clicked", accessor: (h: SentNotificationGroup) => h.clicked_count },
      { key: "ctr_pct", label: "CTR %", accessor: (h: SentNotificationGroup) => h.ctr.toFixed(1) },
      { key: "dismiss_pct", label: "Dismiss %", accessor: (h: SentNotificationGroup) => h.dismiss_rate.toFixed(1) },
    ];
    exportCsv(filtered, columns, "notifications-history.csv");
  };

  const handleDuplicate = (g: SentNotificationGroup) => {
    onDuplicate({
      type: g.type, title: g.title, body: g.body || undefined,
      cta_label: g.cta_label || undefined, cta_url: g.cta_url || undefined,
      image_url: g.image_url || undefined, lottie_url: g.lottie_url || undefined,
      priority: g.priority, targeting: "broadcast",
    });
    toast({ title: "Duplicated", description: "Opened in composer — review targeting and send." });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<Send className="h-4 w-4" />} label="Sent (7d)" value={stats.sent7d.toString()} />
        <StatCard icon={<MousePointer className="h-4 w-4" />} label="Avg CTR" value={`${stats.avgCtr.toFixed(1)}%`} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Avg dismiss" value={`${stats.avgDismiss.toFixed(1)}%`} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Top performer" value={stats.top} truncate />
      </div>

      <Card className="p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(["celebration", "announcement", "ad", "milestone", "info", "warning"] as const).map((t) =>
              <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> CSV</Button>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead className="text-right">Shown</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Dismiss</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No notifications yet.</TableCell></TableRow>}
            {filtered.map((g) => (
              <TableRow key={g.group_id}>
                <TableCell><Badge className={TYPE_COLORS[g.type]}>{g.type}</Badge></TableCell>
                <TableCell className="font-medium max-w-xs truncate">{g.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{g.target_description}</TableCell>
                <TableCell className="text-right tabular-nums">{g.recipients}</TableCell>
                <TableCell className="text-right tabular-nums">{g.shown_count}</TableCell>
                <TableCell className="text-right tabular-nums">{g.ctr.toFixed(1)}%</TableCell>
                <TableCell className="text-right tabular-nums">{g.dismiss_rate.toFixed(1)}%</TableCell>
                <TableCell className="text-xs">{formatDistanceToNow(new Date(g.created_at), { addSuffix: true })}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => setSelected(g)} title="Details"><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDuplicate(g)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleRevoke(g)} title="Revoke"><Ban className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-[480px] sm:w-[560px] overflow-y-auto">
          <SheetHeader><SheetTitle>{selected?.title}</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <KV label="Type" value={selected.type} />
                <KV label="Priority" value={selected.priority.toString()} />
                <KV label="Recipients" value={selected.recipients.toString()} />
                <KV label="Shown" value={selected.shown_count.toString()} />
                <KV label="Clicked" value={selected.clicked_count.toString()} />
                <KV label="Dismissed" value={selected.dismissed_count.toString()} />
                <KV label="CTR" value={`${selected.ctr.toFixed(2)}%`} />
                <KV label="Dismiss rate" value={`${selected.dismiss_rate.toFixed(2)}%`} />
              </div>
              <div><p className="text-xs text-muted-foreground mb-1">Target</p><p>{selected.target_description}</p></div>
              {selected.body && <div><p className="text-xs text-muted-foreground mb-1">Body</p><p className="whitespace-pre-line">{selected.body}</p></div>}
              {selected.cta_url && <div><p className="text-xs text-muted-foreground mb-1">CTA</p><p>{selected.cta_label} → <a href={selected.cta_url} target="_blank" rel="noreferrer" className="text-primary underline">{selected.cta_url}</a></p></div>}
              <div><p className="text-xs text-muted-foreground mb-1">Raw metadata</p><pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-60">{JSON.stringify(selected.metadata, null, 2)}</pre></div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ icon, label, value, truncate }: { icon: React.ReactNode; label: string; value: string; truncate?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <p className={`text-lg font-semibold ${truncate ? "truncate" : ""}`}>{value}</p>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}