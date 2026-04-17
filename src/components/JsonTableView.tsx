import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TableProperties, Braces } from "lucide-react";

interface JsonTableViewProps {
  data: unknown;
  maxDepth?: number;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArrayOfObjects(val: unknown): val is Record<string, unknown>[] {
  return Array.isArray(val) && val.length > 0 && isObject(val[0]);
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

function RenderValue({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "default" : "secondary"} className="text-xs">
        {value ? "Yes" : "No"}
      </Badge>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono text-sm">{value.toLocaleString()}</span>;
  }
  if (typeof value === "string") {
    if (value.length > 120) {
      return <span className="text-sm break-words">{value.substring(0, 120)}...</span>;
    }
    return <span className="text-sm">{value}</span>;
  }
  if (isArrayOfObjects(value) && depth < 2) {
    return <NestedArrayTable data={value} depth={depth + 1} />;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground text-sm">Empty list</span>;
    return (
      <div className="space-y-1">
        {value.slice(0, 5).map((item, i) => (
          <div key={i} className="text-sm">{formatValue(item)}</div>
        ))}
        {value.length > 5 && (
          <span className="text-xs text-muted-foreground">+{value.length - 5} more</span>
        )}
      </div>
    );
  }
  if (isObject(value) && depth < 2) {
    return <NestedObjectTable data={value} depth={depth + 1} />;
  }
  return <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(value)}</span>;
}

function NestedObjectTable({ data, depth }: { data: Record<string, unknown>; depth: number }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <span className="text-muted-foreground text-sm">Empty</span>;

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableBody>
          {entries.map(([key, val]) => (
            <TableRow key={key} className="border-b last:border-b-0">
              <TableCell className="py-1.5 px-3 font-medium text-xs text-muted-foreground w-[140px] bg-muted/30">
                {key.replace(/_/g, " ")}
              </TableCell>
              <TableCell className="py-1.5 px-3">
                <RenderValue value={val} depth={depth} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function NestedArrayTable({ data, depth }: { data: Record<string, unknown>[]; depth: number }) {
  if (data.length === 0) return <span className="text-muted-foreground text-sm">Empty list</span>;

  const columns = Array.from(new Set(data.flatMap(row => Object.keys(row)))).filter(col => {
    return data.some(row => {
      const v = row[col];
      return v !== null && v !== undefined && v !== "";
    });
  });

  const priorityColumns = ["id", "name", "title", "sku", "quantity", "total", "price", "subtotal", "status"];
  const sortedColumns = [
    ...priorityColumns.filter(c => columns.includes(c)),
    ...columns.filter(c => !priorityColumns.includes(c)),
  ].slice(0, 8);

  return (
    <div className="border rounded-md overflow-auto max-h-[300px]">
      <Table>
        <TableHeader>
          <TableRow>
            {sortedColumns.map(col => (
              <TableHead key={col} className="text-xs py-1.5 px-3 whitespace-nowrap">
                {col.replace(/_/g, " ")}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 20).map((row, i) => (
            <TableRow key={i}>
              {sortedColumns.map(col => (
                <TableCell key={col} className="py-1.5 px-3 text-sm">
                  <RenderValue value={row[col]} depth={depth} />
                </TableCell>
              ))}
            </TableRow>
          ))}
          {data.length > 20 && (
            <TableRow>
              <TableCell colSpan={sortedColumns.length} className="text-center text-xs text-muted-foreground py-2">
                +{data.length - 20} more rows
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function JsonTableView({ data, maxDepth = 2 }: JsonTableViewProps) {
  const [viewMode, setViewMode] = useState<"json" | "table">("json");

  if (data === null || data === undefined) {
    return <span className="text-muted-foreground">No data</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "json" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("json")}
          className="h-7 text-xs gap-1.5"
        >
          <Braces className="h-3 w-3" />
          JSON
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
          className="h-7 text-xs gap-1.5"
        >
          <TableProperties className="h-3 w-3" />
          Table
        </Button>
      </div>

      {viewMode === "json" ? (
        <pre className="bg-muted/50 border rounded-md p-3 text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap break-words">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <div className="space-y-2">
          {isArrayOfObjects(data) ? (
            <NestedArrayTable data={data} depth={0} />
          ) : isObject(data) ? (
            <NestedObjectTable data={data as Record<string, unknown>} depth={0} />
          ) : Array.isArray(data) ? (
            <div className="border rounded-md p-3">
              {data.map((item, i) => (
                <div key={i} className="text-sm py-1 border-b last:border-b-0">{formatValue(item)}</div>
              ))}
            </div>
          ) : (
            <div className="text-sm">{formatValue(data)}</div>
          )}
        </div>
      )}
    </div>
  );
}