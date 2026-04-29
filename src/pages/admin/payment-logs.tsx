import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthProvider";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import { useTranslation } from "next-i18next";
import { formatDateTime } from "@/lib/format-number";

type PaymentLog = {
  id: string;
  gateway: string;
  event_type: string;
  status: "success" | "failed" | "pending";
  request_body: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
};

export default function PaymentLogsPage() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { profile, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (profile && !isSuperAdmin && profile.role !== "admin") {
      router.push("/");
    }
  }, [profile, isSuperAdmin, router]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["payment-logs"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/admin/payment-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json() as Promise<PaymentLog[]>;
    },
    enabled: profile?.role === "admin",
  });

  if (profile && !isSuperAdmin && profile.role !== "admin") {
    return null;
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = search === "" || 
      log.event_type.toLowerCase().includes(search.toLowerCase()) ||
      log.id.toLowerCase().includes(search.toLowerCase());
    const matchesGateway = gatewayFilter === "all" || log.gateway === gatewayFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesGateway && matchesStatus;
  });

  const gateways = Array.from(new Set(logs.map((l) => l.gateway)));

  return (
    <AppLayout title="Payment Logs">
      <div className="p-6 space-y-6 max-w-7xl">
        <div>
          <h1 className="text-2xl font-semibold">Payment Transaction Logs</h1>
          <p className="text-muted-foreground">Webhook events and API transactions from payment gateways</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Real-time log of payment gateway interactions</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Gateway" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Gateways</SelectItem>
                    {gateways.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No payment logs found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(log.created_at, i18n.language)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.gateway}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.event_type}</TableCell>
                      <TableCell>
                        {log.status === "success" && (
                          <div className="flex items-center gap-1.5 text-success">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-medium">Success</span>
                          </div>
                        )}
                        {log.status === "failed" && (
                          <div className="flex items-center gap-1.5 text-destructive">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">Failed</span>
                          </div>
                        )}
                        {log.status === "pending" && (
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs font-medium">Pending</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {log.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}