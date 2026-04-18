import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Timer, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { formatDate, formatDuration } from "./formatters";

export interface CronLog {
  id: string;
  job_type: string;
  store_id: string | null;
  status: string;
  message: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

interface LogsPanelProps {
  cronLogs: CronLog[];
  loadingLogs: boolean;
  onRefresh: () => void;
}

export function LogsPanel({ cronLogs, loadingLogs, onRefresh }: LogsPanelProps) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Timer className="h-5 w-5" /></div>
          <div><p className="text-2xl font-semibold">{cronLogs.length}</p><p className="text-xs text-muted-foreground">Total Jobs</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-semibold">{cronLogs.filter((l) => l.status === "completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><XCircle className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-2xl font-semibold">{cronLogs.filter((l) => l.status === "failed").length}</p><p className="text-xs text-muted-foreground">Failed</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><RefreshCw className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-semibold">{cronLogs.filter((l) => l.status === "started").length}</p><p className="text-xs text-muted-foreground">Running</p></div>
        </div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-lg">Scheduled Sync Jobs</CardTitle><CardDescription>History of automated sync executions</CardDescription></div>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loadingLogs}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingLogs ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : cronLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Timer className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No scheduled sync jobs yet</p><p className="text-sm">Configure a sync interval in Settings to enable automatic syncing</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Type</TableHead><TableHead>Status</TableHead><TableHead>Message</TableHead><TableHead>Started</TableHead><TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cronLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell><code className="text-sm bg-muted px-1.5 py-0.5 rounded">{log.job_type}</code></TableCell>
                    <TableCell><StatusBadge variant={log.status === "completed" ? "success" : log.status === "failed" ? "error" : "pending"}>{log.status}</StatusBadge></TableCell>
                    <TableCell className="max-w-xs"><p className="truncate text-sm">{log.error_message || log.message || "-"}</p></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(log.started_at)}</TableCell>
                    <TableCell className="font-mono text-sm">{log.completed_at ? formatDuration(log.started_at, log.completed_at) : "Running..."}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}