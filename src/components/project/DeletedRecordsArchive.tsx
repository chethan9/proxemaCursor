import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Archive, Loader2, Eye, Package, ShoppingCart, Users, Layers, Ticket } from "lucide-react";
import { JsonTableView } from "@/components/JsonTableView";
import { ENTITY_TYPE_FILTERS } from "./constants";
import { formatDate } from "./formatters";

type DeletedRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  woo_id: number | null;
  entity_name: string | null;
  snapshot: unknown;
  source: string | null;
  deleted_at: string | null;
};

const typeIcons: Record<string, typeof Package> = {
  product: Package,
  order: ShoppingCart,
  customer: Users,
  category: Layers,
  coupon: Ticket,
};

export function DeletedRecordsArchive({ storeId }: { storeId: string }) {
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DeletedRecord | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("deleted_records")
        .select("*")
        .eq("store_id", storeId)
        .order("deleted_at", { ascending: false })
        .limit(200);

      if (filter !== "all") query = query.eq("entity_type", filter);

      const { data } = await query;
      setRecords((data || []) as DeletedRecord[]);
      setLoading(false);
    }
    load();
  }, [storeId, filter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Deleted Records Archive
            </CardTitle>
            <CardDescription>Records deleted from WooCommerce, preserved for audit trail</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {ENTITY_TYPE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.value)}
                className="text-xs"
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No deleted records found</p>
            <p className="text-sm">When items are deleted from WooCommerce via webhooks, they will appear here</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>WooCommerce ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => {
                  const IconComp = typeIcons[rec.entity_type] || Package;
                  return (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconComp className="h-4 w-4 text-muted-foreground" />
                          <span className="capitalize text-sm">{rec.entity_type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{rec.entity_name || "-"}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">#{rec.woo_id}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{rec.source || "webhook"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(rec.deleted_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(rec)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Deleted {selectedRecord?.entity_type} — {selectedRecord?.entity_name}</DialogTitle>
                  <DialogDescription>
                    Last known snapshot before deletion (WooCommerce ID: #{selectedRecord?.woo_id})
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <JsonTableView data={selectedRecord?.snapshot} />
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}