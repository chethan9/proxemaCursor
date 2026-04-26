import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import Link from "next/link";
import { useActiveBulkJobs } from "@/hooks/queries/useBulkJobs";
import { cancelBulkJob, JOB_TYPE_LABEL, type BulkJob } from "@/services/bulkJobService";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function BulkJobsToast() {
  const { data: jobs = [] } = useActiveBulkJobs();
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  if (dismissed || jobs.length === 0) return null;

  const active = jobs.filter((j) => j.status === "running" || j.status === "pending");
  if (active.length === 0) return null;

  const handleCancel = async (j: BulkJob) => {
    try {
      await cancelBulkJob(j.id);
      qc.invalidateQueries({ queryKey: ["bulk-jobs"] });
      toast({ title: "Job cancelled" });
    } catch (e) {
      toast({ title: "Failed to cancel", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <Card className="shadow-lg border-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs font-semibold">
            {active.length} bulk job{active.length > 1 ? "s" : ""} running
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
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
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