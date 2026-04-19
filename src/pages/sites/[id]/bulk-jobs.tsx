import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Ban } from "lucide-react";
import { useStoreBulkJobs } from "@/hooks/queries/useBulkJobs";
import { cancelBulkJob, JOB_TYPE_LABEL, type BulkJob } from "@/services/bulkJobService";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/hooks/queries/useStores";

const STATUS_META: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  pending: { icon: Loader2, cls: "text-muted-foreground" },
  running: { icon: Loader2, cls: "text-primary animate-spin" },
  completed: { icon: CheckCircle2, cls: "text-success" },
  failed: { icon: XCircle, cls: "text-destructive" },
  cancelled: { icon: Ban, cls: "text-muted-foreground" },
};

export default function BulkJobsPage() {
  const router = useRouter();
  const storeId = typeof router.query.id === "string" ? router.query.id : null;
  const { data: store } = useStore(storeId);
  const { data: jobs = [], isLoading } = useStoreBulkJobs(storeId, 100);
  const { toast } = useToast();
  const qc = useQueryClient();

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
    <AppLayout title={`Bulk Jobs · ${store?.name ?? ""}`}>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Bulk Jobs</h1>
          <p className="text-sm text-muted-foreground">Background jobs for {store?.name ?? "this store"}</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Job history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[220px]">Progress</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No bulk jobs yet</TableCell></TableRow>
                ) : (
                  jobs.map((j) => {
                    const meta = STATUS_META[j.status] ?? STATUS_META.pending;
                    const Icon = meta.icon;
                    const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
                    const running = j.status === "running" || j.status === "pending";
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="font-medium text-sm">{JOB_TYPE_LABEL[j.job_type as keyof typeof JOB_TYPE_LABEL] || j.job_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />
                            <Badge variant="outline" className="text-[10px] capitalize">{j.status}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-mono">{j.processed}/{j.total}</span>
                              <span>{pct}%</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-success">{j.succeeded}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-destructive">{j.failed}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {j.started_at ? new Date(j.started_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {running && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleCancel(j)}>Cancel</Button>
                          )}
                          {j.error_message && (
                            <span title={j.error_message} className="text-[11px] text-destructive inline-flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> error
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}