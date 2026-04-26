import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, Loader2, X, Download, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActiveBulkJobs, useRecentCompletedPrintJobs } from "@/hooks/queries/useBulkJobs";
import { cancelBulkJob, JOB_TYPE_LABEL, type BulkJob } from "@/services/bulkJobService";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function BulkJobsToast() {
  const { data: jobs = [] } = useActiveBulkJobs();
  const { data: completedPrints = [] } = useRecentCompletedPrintJobs();
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissedDownloads, setDismissedDownloads] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const qc = useQueryClient();

  const active = jobs.filter((j) => j.status === "running" || j.status === "pending");
  const visibleDownloads = completedPrints.filter((j) => !dismissedDownloads.has(j.id));

  if (dismissed) return null;
  if (active.length === 0 && visibleDownloads.length === 0) return null;

  const handleCancel = async (j: BulkJob) => {
    try {
      await cancelBulkJob(j.id);
      qc.invalidateQueries({ queryKey: ["bulk-jobs"] });
      toast({ title: "Job cancelled" });
    } catch (e) {
      toast({ title: "Failed to cancel", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const handleDownload = async (jobId: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast({ title: "Sign in required", variant: "destructive" });
        return;
      }
      const res = await fetch(`/api/bulk-jobs/${jobId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = res.headers.get("content-type")?.includes("zip") ? "zip" : "pdf";
      a.download = `invoices-${jobId.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const dismissDownload = (id: string) => {
    setDismissedDownloads((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const headerLabel = active.length > 0
    ? `${active.length} bulk job${active.length > 1 ? "s" : ""} running`
    : `${visibleDownloads.length} ready to download`;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <Card className="shadow-lg border-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          {active.length > 0 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
          <span className="text-xs font-semibold">{headerLabel}</span>
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
            {visibleDownloads.map((j) => {
              const mode = (j.payload as { output_mode?: string } | null)?.output_mode || "single-pdf";
              return (
                <div key={j.id} className="p-3 space-y-1.5 bg-emerald-50/40 dark:bg-emerald-950/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate flex-1">
                      Invoices ready · {j.succeeded}/{j.total}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{mode === "zip" ? "ZIP" : "PDF"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs gap-1.5 flex-1" onClick={() => handleDownload(j.id)}>
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => dismissDownload(j.id)}>
                      Dismiss
                    </Button>
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