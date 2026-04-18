import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import { Activity } from "lucide-react";
import type { ApiCallLog } from "@/services/apiKeyService";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-200",
  POST: "bg-blue-100 text-blue-700 border-blue-200",
  PATCH: "bg-amber-100 text-amber-700 border-amber-200",
  DELETE: "bg-rose-100 text-rose-700 border-rose-200",
};

function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface ApiCallLogsProps {
  logs: ApiCallLog[];
  total: number;
}

export function ApiCallLogs({ logs, total }: ApiCallLogsProps) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent API Calls</CardTitle>
          <CardDescription>No calls logged yet</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Activity className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="mt-4 text-sm font-medium">No API calls logged yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Calls made with your API keys will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent API Calls</CardTitle>
        <CardDescription>{total.toLocaleString()} total calls across all keys</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="h-10 pl-4 text-xs font-medium w-[160px]">Time</TableHead>
                <TableHead className="h-10 text-xs font-medium w-[80px]">Method</TableHead>
                <TableHead className="h-10 text-xs font-medium">Path</TableHead>
                <TableHead className="h-10 text-xs font-medium w-[80px]">Status</TableHead>
                <TableHead className="h-10 text-right text-xs font-medium w-[90px]">Duration</TableHead>
                <TableHead className="h-10 pr-4 text-xs font-medium w-[120px]">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id} className="border-border/40">
                  <TableCell className="pl-4 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(l.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className={"inline-flex items-center justify-center rounded border px-2 py-0.5 text-[11px] font-bold " + (METHOD_COLORS[l.method || "GET"] || "bg-muted")}>
                      {l.method}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate font-mono text-xs">{l.path}</TableCell>
                  <TableCell>
                    <StatusBadge variant={(l.status_code || 0) < 400 ? "success" : "error"}>
                      {l.status_code}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{l.response_time_ms}ms</TableCell>
                  <TableCell className="pr-4 font-mono text-xs text-muted-foreground">{l.ip_address}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}