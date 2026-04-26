import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, Loader2, Download, X } from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveBulkJobs } from "@/hooks/queries/useBulkJobs";
import { cancelBulkJob, JOB_TYPE_LABEL, type BulkJob } from "@/services/bulkJobService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function BulkJobsToast() {
  const { data: activeJobs = [] } = useActiveBulkJobs();
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissedDownloads, setDismissedDownloads] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: completedPrints = [] } = useQuery({
    queryKey: ["bulk-jobs", "completed-prints"],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("bulk_jobs")
        .select("*")
        .eq("job_type", "print_invoices_bulk")
        .eq("status", "completed")
        .gte("completed_at", sinceIso)
        .order("completed_at", { ascending: false })
        .limit(5);
      return (data ?? []) as BulkJob[];
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const active = activeJobs.filter((j) => j.status === "running" || j.status === "pending");
  const downloads = completedPrints.filter((j) => !dismissedDownloads.has(j.id));

  if (dismissed || (active.length === 0 && downloads.length === 0)) return null;

  const handleCancel = async (j: BulkJob) => {
    try {
      await cancelBulkJob(j.id);
      qc.invalidateQueries({ queryKey: ["bulk-jobs"] });
      toast({ title: "Job cancelled" });
    } catch (e) {
      toast({ title: "Failed to cancel", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const handleDownload = async (j: BulkJob) => {
    setDownloadingId(j.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(`/api/bulk-jobs/${j.id}/download`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <Card className="shadow-lg border-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          {active.length > 0 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Download className="h-3.5 w-3.5 text-emerald-600" />
          )}
          <span className="text-xs font-semibold">
            {active.length > 0 && `${active.length} running`}
            {active.length > 0 && downloads.length > 0 && " · "}
            {downloads.length > 0 && `${downloads.length} ready`}
          </span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMinimized((v) => !v)}>
            {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDismissed(true)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {!minimized && (
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {downloads.map((j) => {
              const ext = ((j.payload as { output_mode?: string } | null)?.output_mode === "zip") ? "ZIP" : "PDF";
              return (
                <div key={j.id} className="p-3 space-y-1.5 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate flex-1">Invoices ready · {j.total} orders</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">Ready</Badge>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Button size="sm" className="h-7 text-[11px] px-2 gap-1" onClick={() => handleDownload(j)} disabled={downloadingId === j.id}>
                      {downloadingId === j.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Download {ext}
                    </Button>
                    <div className="flex-1" />
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => setDismissedDownloads((s) => { const n = new Set(s); n.add(j.id); return n; })}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              );
            })}
            {active.map((j) => {
              const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
              return (
                <div key={j.id} className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate flex-1">{JOB_TYPE_LABEL[j.job_type as keyof typeof JOB_TYPE_LABEL] || j.job_type}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{j.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{j.processed}/{j.total}</span>
                    {j.failed > 0 && <span className="text-destructive">· {j.failed} failed</span>}
                    <span className="flex-1" />
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center gap-2 pt-0.5">
                    <Link href={`/sites/${j.store_id}/bulk-jobs`} className="text-[11px] text-primary hover:underline">Details</Link>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-destructive hover:text-destructive" onClick={() => handleCancel(j)}>Cancel</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}