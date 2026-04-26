import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { RefreshCw, XCircle, Clock, Database, CheckCircle2, TrendingUp, Calendar, Trash2 } from "lucide-react";
import { SYNC_ASPECTS } from "./constants";
import { formatDate, formatDuration, formatRelativeTime } from "./formatters";
import type { Store } from "@/services/storeService";
import type { SyncRun } from "@/services/syncService";

interface SyncProgress { current: number; total: number; aspect: string; }

interface SyncPanelProps {
  store: Store;
  syncing: boolean;
  syncProgress: SyncProgress | null;
  dataCounts: Record<string, number>;
  syncRuns: SyncRun[];
  onSyncAll: () => void;
  onCancelSync: () => void;
  onSyncAspect: (aspect: string) => void;
  onClearHistory: () => void;
  onSelectRun: (run: SyncRun) => void;
  getStatusIcon: (status: string) => React.ReactNode;
}

export function SyncPanel({
  store, syncing, syncProgress, dataCounts, syncRuns,
  onSyncAll, onCancelSync, onSyncAspect, onClearHistory, onSelectRun, getStatusIcon,
}: SyncPanelProps) {
  const totalRecords = Object.values(dataCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                {!syncing ? (
                  <Button size="lg" onClick={onSyncAll} className="min-w-[160px]">
                    <RefreshCw className="h-4 w-4 mr-2" />Sync All Data
                  </Button>
                ) : (
                  <Button size="lg" variant="destructive" onClick={onCancelSync} className="min-w-[160px]">
                    <XCircle className="h-4 w-4 mr-2" />Cancel Sync
                  </Button>
                )}
                <div className="text-sm text-muted-foreground">
                  {store.last_sync_at ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Last sync: {formatRelativeTime(store.last_sync_at)}
                    </span>
                  ) : <span>Never synced</span>}
                </div>
              </div>
              {syncing && syncProgress && (() => {
                const pct = Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100));
                const isFinalizing = pct >= 99;
                const labelOverride = isFinalizing ? "Finalizing — wrapping up post-processing…" : syncProgress.aspect;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{labelOverride}</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <Progress value={Math.min(100, (syncProgress.current / syncProgress.total) * 100)} className="h-2" />
                  </div>
                );
              })()}
            </div>
            <TooltipProvider>
              <div className="grid grid-cols-6 gap-4 lg:gap-6">
                {SYNC_ASPECTS.map((aspect) => {
                  const AspectIcon = aspect.icon;
                  const count = dataCounts[aspect.id] || 0;
                  return (
                    <Tooltip key={aspect.id}>
                      <TooltipTrigger asChild>
                        <button onClick={() => onSyncAspect(aspect.id)} disabled={syncing}
                          className="text-center group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                          <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-muted mb-1 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                            <AspectIcon className={`h-5 w-5 ${aspect.color}`} />
                          </div>
                          <p className="text-lg font-semibold">{count.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{aspect.label}</p>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent><p>Click to sync {aspect.label.toLowerCase()} only</p></TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Database className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-semibold">{totalRecords.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Records</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-semibold">{syncRuns.filter(r => r.status === "completed").length}</p><p className="text-xs text-muted-foreground">Successful Syncs</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-semibold">{syncRuns.reduce((s, r) => s + (r.records_created || 0), 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Records Created</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Calendar className="h-5 w-5 text-muted-foreground" /></div>
          <div><p className="text-sm font-semibold">{store.next_sync_at ? formatDate(store.next_sync_at) : "Not scheduled"}</p><p className="text-xs text-muted-foreground">Next Sync</p></div>
        </div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-lg">Sync History</CardTitle><CardDescription>Recent sync operations for this site</CardDescription></div>
            {syncRuns.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />Clear History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear sync history?</AlertDialogTitle>
                    <AlertDialogDescription>This will remove all sync run records for this site. This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Aspect</TableHead><TableHead>Status</TableHead>
                <TableHead>Records</TableHead><TableHead>Duration</TableHead><TableHead className="pr-6">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncRuns.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No sync runs yet. Click &quot;Sync All Data&quot; to start.</TableCell></TableRow>
              ) : (
                syncRuns.slice(0, 25).map((run) => (
                  <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectRun(run)}>
                    <TableCell className="pl-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {(() => {
                          const aspect = SYNC_ASPECTS.find(a => a.id === run.aspect);
                          if (aspect) { const Icon = aspect.icon; return <Icon className={`h-4 w-4 ${aspect.color}`} />; }
                          return null;
                        })()}
                        <span className="font-medium capitalize">{run.aspect}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">{getStatusIcon(run.status || "pending")}<span className="capitalize">{run.status}</span></div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      {run.records_processed ? (
                        <span>{run.records_processed}{run.records_created ? (<span className="text-success text-xs ml-1">+{run.records_created}</span>) : null}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm py-3.5">{formatDuration(run.started_at || "", run.completed_at)}</TableCell>
                    <TableCell className="pr-6 py-3.5 text-muted-foreground">{formatDate(run.started_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}