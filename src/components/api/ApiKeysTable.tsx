import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, EyeOff, Trash2 } from "lucide-react";
import type { ApiKey } from "@/services/apiKeyService";

function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface ApiKeysTableProps {
  keys: ApiKey[];
  keyStats: Record<string, { totalCalls: number; last24h: number; avgResponseTime: number; errorRate: number }>;
  loading: boolean;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ApiKeysTable({ keys, keyStats, loading, onRevoke, onDelete }: ApiKeysTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading API keys...</p>
        </CardContent>
      </Card>
    );
  }

  if (keys.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Key className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="mt-4 text-sm font-medium">No API keys yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create one to start using the Proxima REST API</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="h-10 pl-4 text-xs font-medium">Name</TableHead>
                <TableHead className="h-10 text-xs font-medium">Client</TableHead>
                <TableHead className="h-10 text-xs font-medium">Key Prefix</TableHead>
                <TableHead className="h-10 text-xs font-medium">Scopes</TableHead>
                <TableHead className="h-10 text-right text-xs font-medium">Rate Limit</TableHead>
                <TableHead className="h-10 text-right text-xs font-medium">24h Calls</TableHead>
                <TableHead className="h-10 text-xs font-medium">Status</TableHead>
                <TableHead className="h-10 text-xs font-medium">Last Used</TableHead>
                <TableHead className="h-10 w-[80px] pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => {
                const st = keyStats[k.id];
                return (
                  <TableRow key={k.id} className="border-border/40">
                    <TableCell className="pl-4 font-medium text-sm">{k.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{k.clients?.name || "\u2014"}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{k.key_prefix}...</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.scopes?.map((s) => (
                          <Badge key={s} variant="secondary" className="h-5 px-1.5 text-[10px] font-mono font-normal">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {k.rate_limit?.toLocaleString()}/hr
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {st ? st.last24h.toLocaleString() : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={k.is_active ? "success" : "error"}>
                        {k.is_active ? "Active" : "Revoked"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(k.last_used_at)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-0.5">
                        {k.is_active && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Revoke" onClick={() => onRevoke(k.id)}>
                            <EyeOff className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Delete" onClick={() => onDelete(k.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}